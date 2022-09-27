const mqtt = require('mqtt');
const crypto = require('crypto');
const EventEmitter = require('events');
const {
  brightBlue,
  brightGreen,
  red,
  yellow,
} = require('../../utilities/ansicodes');

const DEBOUNCE_MILLISECONDS = 100;
const PROPAGATION_DEBOUNCE_MILLISECONDS = 1000;

const actionPriorityOrder = [
  ['preset'],
  ['fade_off'],
  ['off', 'off_if_on'],
  ['fade_on'],
  ['on', 'on_if_off'],
  ['toggle'],
  ['fade_brightness', 'fade_luminance', 'fade_temperature'],
  ['light', 'brightness', 'luminance', 'dimmer', 'temperature', 'mode'],
  ['fade_color'],
  ['color'],
  ['toggle_preserve'],
  ['on_preserve'],
];

const actionPriorityOrderNumbers = Object.fromEntries(actionPriorityOrder.flatMap((actions, index) => (
  actions.map((action) => [action, index])
)));

const dedupeDeviceActions = (deviceActions) => {
  const { _ } = global;
  return Object.entries(_.groupBy(deviceActions, 'nickname')).map(([nickname, groupedDeviceActions]) => {
    const flattenedActions = groupedDeviceActions.flatMap((deviceAction) => deviceAction.actions);
    const priorityNumbers = flattenedActions.map((action) => actionPriorityOrderNumbers[action.action] || 1000);
    const highestPriority = Math.min(...priorityNumbers);
    const filteredActions = flattenedActions.filter((action) => (
      actionPriorityOrderNumbers[action.action] === highestPriority
    ));

    const dedupedActions = Object.values(_.keyBy(filteredActions, 'action'));
    return {
      nickname,
      actions: dedupedActions,
    };
  });
};

class MQTTClient extends EventEmitter {
  constructor(token, key, userId, deviceLinks, device, logger) {
    super();

    this.token = token;
    this.key = key;
    this.deviceLinks = deviceLinks;
    this.userId = userId;
    this.device = device;
    this.logger = logger;

    // eslint-disable-next-line global-require
    this.deviceHelper = require('../../helpers/deviceHelper');
  }

  connect(callback) {
    const domain = process.env.LOCAL_MQTT_HOSTNAME || 'localhost';
    const port = 8883;

    // Password is calculated as the MD5 of USERID concatenated with KEY
    const hashedPassword = crypto.createHash('md5').update(this.userId + this.key).digest('hex');

    this.client = mqtt.connect({
      protocol: 'mqtts',
      host: domain,
      port,
      clientId: `smart_home_api-${process.env.ENVIRONMENT}`,
      username: this.userId,
      password: hashedPassword,
      rejectUnauthorized: false,
      keepalive: 30,
      reconnectPeriod: 5000,
    });

    this.client.on('connect', () => {
      // console.log("Connected. Subscribe to user topics");

      Object.keys(this.deviceLinks).forEach((topic) => {
        this.client.subscribe(topic, (err) => {
          if (err) {
            this.emit('error', err);
          }
          // console.log('User Subscribe Done');
        });
      });

      callback?.();
      this.emit('connected');
    });

    this.client.on('message', (topic, message) => {
      if (!message) {
        return;
      }
      let mutableMessage;
      try {
        mutableMessage = JSON.parse(message.toString());
      } catch (e) {
        mutableMessage = message.toString();
      }

      const { fn, Devices } = global;
      const deviceLinkActions = this.deviceLinks[topic];

      const deviceActions = deviceLinkActions.flatMap(({
        targetDevices,
        messageValueExtractor,
        messageEventExtractor,
        event,
        action,
        value,
        valueDatatype,
      }) => targetDevices.map(({
        mfg_id: mfgId,
        name,
      }) => {
        const extractedEvent = messageEventExtractor(mutableMessage);
        if (extractedEvent !== event) {
          if (event === 'power') {
            if (!extractedEvent.includes('power', 'on', 'off', 'toggle')) {
              return null;
            }
          } else {
            return null;
          }
        }
        const extractedValue = messageValueExtractor(mutableMessage);
        const mirroredAction = event === 'power' ? extractedValue.toLowerCase() : event;
        const deviceAction = action === 'mirror' ? mirroredAction : action;
        const castedValue = fn.castActionValue(value === 'mirror' ? extractedValue : value, valueDatatype);
        const isOn = Devices[mfgId]?.Device?.state;
        if ((deviceAction === 'on_if_off' && isOn)
          || (deviceAction === 'off_if_on' && !isOn)) {
          return null;
        }
        return {
          nickname: name,
          actions: [{
            action: deviceAction,
            value: castedValue,
          }],
        };
      }))
        .filter((action) => action);

      const now = (new Date()).getTime();
      const filteredDeviceActions = deviceActions
        .map(({
          nickname,
          actions,
        }) => ({
          nickname,
          actions: actions.filter(({
            action,
            value,
          }) => {
            const actionTime = global.actionPropagation[nickname]?.[action]?.[value];
            return !actionTime || now > (actionTime + PROPAGATION_DEBOUNCE_MILLISECONDS);
          }),
        }))
        .filter(({ actions }) => actions && actions.length > 0);

      filteredDeviceActions.forEach(({ nickname, actions }) => {
        global.deviceLinkActions[nickname] = [
          ...(global.deviceLinkActions[nickname] || []),
          ...actions,
        ];

        if (global.debounces[nickname]) {
          clearTimeout(global.debounces[nickname].timeout);
        }

        global.debounces[nickname] = {
          time: (new Date()).getTime(),
          timeout: setTimeout(() => {
            const deviceActions = [
              {
                nickname,
                actions: global.deviceLinkActions[nickname],
              },
            ];

            if (!global.deviceLinkActions[nickname]) {
              return;
            }

            this.deviceHelper.performDeviceActions(dedupeDeviceActions(deviceActions)).then(() => {
              delete global.debounces[nickname];
              delete global.deviceLinkActions[nickname];
              const now = (new Date()).getTime();
              deviceActions.forEach(({
                nickname,
                actions,
              }) => {
                actions.forEach(({
                  action,
                  value,
                }) => {
                  global.actionPropagation[nickname] = {
                    ...(global.actionPropagation[nickname] || {}),
                    [action]: {
                      [value]: now,
                    },
                  };
                });
              });
            });
          }, DEBOUNCE_MILLISECONDS),
        };
      });

      this.emit('rawData', mutableMessage);
    });
    this.client.on('error', (error) => {
      this.emit('error', error ? error.toString() : null);
    });
    this.client.on('close', (error) => {
      this.emit('close', error ? error.toString() : null);
    });
    this.client.on('reconnect', () => {
      this.emit('reconnect');
    });

    this.on('connected', () => {
      this.logger.info(this.device.devName, '.'.repeat(Math.abs(30 - this.device.devName.length)), brightGreen('connected'));
    });
    this.on('error', (error) => {
      this.logger.error(this.device.devName, '.'.repeat(Math.abs(30 - this.device.devName.length)), red('error'));
      if (error) {
        this.logger.error(error);
      }
    });
    this.on('close', (error) => {
      this.logger.info(this.device.devName, '.'.repeat(Math.abs(30 - this.device.devName.length)), brightBlue('close'));
      if (error) {
        this.logger.error(error);
      }
    });
    this.on('reconnect', () => {
      this.logger.info(this.device.devName, '.'.repeat(Math.abs(30 - this.device.devName.length)), yellow('reconnect'));
    });

    // mqtt.Client#end([force], [options], [cb])
    // mqtt.Client#reconnect()
  }

  disconnect(force) {
    this.client.end(force);
  }
}

module.exports = MQTTClient;

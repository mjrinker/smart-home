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

const actionPriorityOrder = [
  ['preset'],
  ['fade_on'],
  ['fade_off'],
  ['toggle'],
  ['on'],
  ['off'],
  ['fade_brightness', 'fade_luminance', 'fade_temperature'],
  ['light', 'brightness', 'luminance', 'temperature', 'mode'],
  ['fade_color'],
  ['color'],
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

  connect() {
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

      this.emit('connected');
    });

    this.client.on('message', (topic, message) => {
      if (!message) {
        return;
      }
      const mutableMessage = message.toString();
      const { nickname, actionTranslator } = this.deviceLinks[topic];
      if (this.deviceLinks[topic]) {
        global.deviceLinkActions[nickname] = [
          ...(global.deviceLinkActions[nickname] || []),
          actionTranslator(mutableMessage),
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
            this.deviceHelper.performDeviceActions(dedupeDeviceActions(deviceActions)).then(() => {
              delete global.debounces[nickname];
              delete global.deviceLinkActions[nickname];
            });
          }, DEBOUNCE_MILLISECONDS),
        };
      }
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

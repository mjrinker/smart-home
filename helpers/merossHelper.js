const {
  brightGreen,
  yellow,
  brightBlue,
  red,
} = require('../utilities/ansicodes');

const MEROSS_URL = 'https://iot.meross.com';
const LOGOUT_URL = `${MEROSS_URL}/v1/Profile/logout`;

const getANSIColor = (event) => {
  switch (event) {
    case 'connect':
    // falls through
    case 'connected': {
      return brightGreen;
    }
    case 'reconnect': {
      return yellow;
    }
    case 'close': {
      return brightBlue;
    }
    case 'error': {
      return red;
    }
    default: {
      return (string) => string;
    }
  }
};

exports.logout = (merossAPI, callback) => {
  merossAPI.disconnectAll(true);
  merossAPI.authenticatedPost(LOGOUT_URL, {}, callback);
};

exports.listeners = () => {
  // eslint-disable-next-line global-require
  const deviceHelper = require('./deviceHelper');

  const {
    _,
    Bulb,
    delay,
    deviceConfigByMfgId,
    deviceTypeClassMap,
    logger,
  } = global;

  const deviceConnectionCallback = (event, deviceId, deviceDef, device) => () => {
    if (!global.Devices[deviceId]) {
      const DeviceType = deviceTypeClassMap?.meross?.[deviceDef.deviceType];
      if (DeviceType) {
        global.Devices[deviceId] = {
          device,
          deviceDef,
          Device: new DeviceType({
            deviceId,
            device,
            deviceDef,
            presets: Object.entries(deviceConfigByMfgId[deviceId]?.presets || {})
              .map(([name, actions]) => ({ name, actions })) || [],
          }),
        };
      } else {
        logger.error(JSON.stringify({
          level: 'ERROR',
          message: 'Cannot find matching device class',
          data: {
            deviceDef,
          },
        }));
      }
    }

    const ansiColor = getANSIColor(event);
    logger.info(deviceDef.devName, '.'.repeat(Math.abs(30 - deviceDef.devName.length)), ansiColor(event));

    if (['connect', 'connected', 'reconnect'].includes(event)) {
      device.getOnlineStatus((error, response) => {
        Date.now(); // needs just a tiny delay which this call provides
        if (global.Devices[deviceId]) {
          global.Devices[deviceId].Device.online = !!response?.online?.status;
        }
      });

      device.getSystemAllData((error, response) => {
        Date.now(); // needs just a tiny delay which this call provides
        if (global.Devices[deviceId]) {
          global.Devices[deviceId].Device.state = !!response?.all?.digest?.togglex[0]?.onoff;
          if (global.Devices[deviceId].Device instanceof Bulb) {
            const lightState = response?.all?.digest?.light;
            if (lightState) {
              global.Devices[deviceId].Device.lightValues = {
                brightness: lightState.luminance || -1,
                color_temp: lightState.temperature || -1,
                color: (Number.isNaN(Number(lightState.rgb))
                  ? 0xffffff : Number(lightState.rgb)).toString(16),
              };
            }
          }
        }
      });
    } else if (['close', 'error'].includes(event) && global.Devices[deviceId]?.Device) {
      global.Devices[deviceId].Device.online = false;
      global.Devices[deviceId].Device.state = false;
    }
  };

  const overrideSleep = 1250;
  global.merossAPI.on('deviceInitialized', (deviceId, deviceDef, device) => {
    device.on('data', async (namespace, payload) => {
      const name = global.modelsBy.Device?.mfg_id[deviceId][0]?.name;
      const actions = {};
      switch (namespace) {
        case 'Appliance.Control.ToggleX': {
          const state = !!payload?.togglex[0]?.onoff;
          if (global.Devices[deviceId]) {
            global.Devices[deviceId].Device.state = state;
          }

          if (!global.Devices[deviceId]?.Device?.lock) {
            const action = state ? 'on' : 'off';
            logger.info('External message', name, action, payload);

            actions[action] = true;

            if (name) {
              const deviceIdInfo = global.deviceConfig[name];
              const { Device } = global.Devices[deviceId];
              if (deviceIdInfo && Device) {
                const deviceData = {
                  nickname: name,
                  presets: deviceIdInfo.presets,
                  info: deviceIdInfo,
                  actions,
                  Device,
                  data: {
                    online: Device.online,
                    state: Device.state,
                  },
                };

                deviceHelper.getTimeBasedActions({
                  deviceIdInfo,
                  deviceData,
                  deviceAction: {
                    nickname: name,
                    actions,
                  },
                }).then(async (timeBasedActions) => {
                  await delay(overrideSleep);
                  if (global.Devices[deviceId]?.Device?.override) {
                    const { preset } = timeBasedActions;
                    const unpackedPreset = preset ? deviceData.presets[preset] : timeBasedActions;
                    if (unpackedPreset && !_.isEqual(actions, unpackedPreset)) {
                      deviceData.actions = (
                        deviceHelper.combineLightValueActions(
                          timeBasedActions,
                          global.Devices[deviceId].Device,
                        )
                      );
                      deviceHelper.performDeviceAction(deviceData).then(() => {
                        global.Devices[deviceId].Device.override = true;
                      }).catch((error) => {
                        logger.error(error);
                        global.Devices[deviceId].Device.override = true;
                      });
                    }
                  } else {
                    global.Devices[deviceId].Device.override = true;
                  }
                });
              }
            }
          }

          break;
        }
        case 'Appliance.Control.Light': {
          if (global.Devices[deviceId]) {
            const newLightValues = payload?.light;
            global.Devices[deviceId].Device.lightValues = {
              brightness: newLightValues?.luminance || -1,
              color_temp: newLightValues?.temperature || -1,
              color: (Number.isNaN(Number(newLightValues?.rgb))
                ? 0xffffff : Number(newLightValues?.rgb)).toString(16),
            };

            if (!global.Devices[deviceId]?.Device?.lock) {
              logger.info('External message', name, 'light', payload);
              global.Devices[deviceId].Device.override = false;
              delay(overrideSleep).then(() => {
                global.Devices[deviceId].Device.override = true;
              });
            }
          }

          break;
        }
        case 'Appliance.System.Online': {
          // device.connect();
          break;
        }
        default: {
          if (!global.Devices[deviceId]?.Device?.lock) {
            logger.info('External message', name, namespace, payload);
          }
          break;
        }
      }
    });

    device.on('connected', deviceConnectionCallback('connected', deviceId, deviceDef, device));
    device.on('reconnect', deviceConnectionCallback('reconnect', deviceId, deviceDef, device));
    device.on('close', deviceConnectionCallback('close', deviceId, deviceDef, device));
    device.on('error', deviceConnectionCallback('error', deviceId, deviceDef, device));
  });
};

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
                colorTemp: lightState.temperature || -1,
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
  global.merossAPI?.on('deviceInitialized', (deviceMfgId, deviceDef, device) => {
    device.on('data', async (namespace, payload) => {
      // eslint-disable-next-line camelcase
      const savedDevice = await global.dataFn.findOne('Device', { mfgId: deviceMfgId });
      const actions = {};
      switch (namespace) {
        case 'Appliance.Control.ToggleX': {
          const state = !!payload?.togglex[0]?.onoff;
          if (global.Devices[deviceMfgId]) {
            global.Devices[deviceMfgId].Device.state = state;
          }

          if (!global.Devices[deviceMfgId]?.Device?.lock) {
            const action = state ? 'on' : 'off';
            logger.info('External message', savedDevice?.name, action, payload);

            actions[action] = true;

            if (savedDevice?.name) {
              const {
                devicesByNickname,
                devicesByGroupId,
                devicesByRoomId,
              } = await deviceHelper.getDevicesByModels([savedDevice?.name], []);
              const devices = Object.values(devicesByNickname).flatMap((devices) => devices);
              const deviceIds = devices.map((device) => device.id);
              const deviceIdsByRoomId = Object.fromEntries(
                Object.entries(devicesByRoomId)
                  .map(([roomId, devices]) => [roomId, devices.map((device) => device.id)]),
              );
              const deviceIdsByGroupId = Object.fromEntries(
                Object.entries(devicesByGroupId)
                  .map(([groupId, devices]) => [groupId, devices.map((device) => device.id)]),
              );
              const roomIds = Object.keys(deviceIdsByRoomId);
              const groupIds = Object.keys(deviceIdsByGroupId);
              const shortPresetActionsByDeviceId = await deviceHelper.getShortPresetActionsByDeviceId({
                deviceIds,
                roomIds,
                groupIds,
                deviceIdsByRoomId,
                deviceIdsByGroupId,
              });

              const conditionalActionsByDeviceId = await exports.getConditionalActionsByDeviceId({
                deviceIds,
                roomIds,
                groupIds,
                deviceIdsByRoomId,
                deviceIdsByGroupId,
              });

              const { Device } = global.Devices[deviceMfgId];
              if (savedDevice && Device) {
                const deviceData = {
                  nickname: savedDevice?.name,
                  presets: shortPresetActionsByDeviceId[savedDevice?.id],
                  info: savedDevice,
                  actions,
                  Device,
                  data: {
                    online: Device.online,
                    state: Device.state,
                  },
                };

                deviceHelper.getTimeBasedActions({
                  conditionalActions: conditionalActionsByDeviceId[savedDevice?.id],
                  deviceData,
                  deviceAction: {
                    nickname: savedDevice?.name,
                    actions,
                  },
                }).then(async (timeBasedActions) => {
                  await delay(overrideSleep);
                  if (global.Devices[deviceMfgId]?.Device?.override) {
                    const { preset } = timeBasedActions;
                    const unpackedPreset = preset ? deviceData.presets[preset] : timeBasedActions;
                    if (unpackedPreset && !_.isEqual(actions, unpackedPreset)) {
                      deviceData.actions = (
                        deviceHelper.combineLightValueActions(
                          timeBasedActions,
                          global.Devices[deviceMfgId].Device,
                        )
                      );
                      deviceHelper.performDeviceAction(deviceData).then(() => {
                        global.Devices[deviceMfgId].Device.override = true;
                      }).catch((error) => {
                        logger.error(error);
                        global.Devices[deviceMfgId].Device.override = true;
                      });
                    }
                  } else {
                    global.Devices[deviceMfgId].Device.override = true;
                  }
                });
              }
            }
          }

          break;
        }
        case 'Appliance.Control.Light': {
          if (global.Devices[deviceMfgId]) {
            const newLightValues = payload?.light;
            global.Devices[deviceMfgId].Device.lightValues = {
              brightness: newLightValues?.luminance || -1,
              colorTemp: newLightValues?.temperature || -1,
              color: (Number.isNaN(Number(newLightValues?.rgb))
                ? 0xffffff : Number(newLightValues?.rgb)).toString(16),
            };

            if (!global.Devices[deviceMfgId]?.Device?.lock) {
              logger.info('External message', savedDevice?.name, 'light', payload);
              global.Devices[deviceMfgId].Device.override = false;
              delay(overrideSleep).then(() => {
                global.Devices[deviceMfgId].Device.override = true;
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
          if (!global.Devices[deviceMfgId]?.Device?.lock) {
            logger.info('External message', savedDevice?.name, namespace, payload);
          }
          break;
        }
      }
    });

    device.on('connected', deviceConnectionCallback('connected', deviceMfgId, deviceDef, device));
    device.on('reconnect', deviceConnectionCallback('reconnect', deviceMfgId, deviceDef, device));
    device.on('close', deviceConnectionCallback('close', deviceMfgId, deviceDef, device));
    device.on('error', deviceConnectionCallback('error', deviceMfgId, deviceDef, device));
  });
};

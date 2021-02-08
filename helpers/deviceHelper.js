const constants = require('./constants');

const {
  _,
  Bulb,
  Climate,
  colors,
  delay,
  deviceConfig,
  Devices,
  dataFn,
  fn,
  Light,
  logger,
  models,
  modelsBy,
  rooms,
  sequelize,
  Thermostat,
  tuyaAPI,
} = global;

exports.calculateNewLightValue = (lightValue, lightProperty, actions, Device) => {
  let mutableLightValue = lightValue;
  const currentLightValue = Device?.lightValues && Device.lightValues[lightProperty];
  if (mutableLightValue) {
    if (`${mutableLightValue}`.substring(0, 1) === '+') {
      if (Device) {
        mutableLightValue = currentLightValue + Number(mutableLightValue.replace(/\D/g, ''));
        mutableLightValue = mutableLightValue > 100 ? 100 : mutableLightValue;
      } else {
        mutableLightValue = null;
      }
    } else if (`${mutableLightValue}`.substring(0, 1) === '-') {
      if (Device) {
        mutableLightValue = currentLightValue - Number(mutableLightValue.replace(/\D/g, ''));
        mutableLightValue = mutableLightValue < 1 ? 1 : mutableLightValue;
      } else {
        mutableLightValue = null;
      }
    }
  }

  return mutableLightValue;
};

exports.combineLightValueActions = (actions, Device) => {
  const newActions = _.cloneDeep(actions);
  const colorValue = newActions.color;
  const brightnessValue = exports.calculateNewLightValue(newActions.brightness || newActions.luminance, 'brightness', newActions, Device);
  const temperatureValue = exports.calculateNewLightValue(newActions.temperature, 'color_temp', newActions, Device);
  delete newActions.luminance;

  if (temperatureValue) {
    newActions.temperature = temperatureValue;
  }

  if (brightnessValue) {
    newActions.brightness = brightnessValue;
    if (colorValue) {
      newActions.light = {
        brightness: brightnessValue,
        color: colorValue,
      };

      delete newActions.color;
      delete newActions.luminance;
      delete newActions.brightness;
    }

    if (temperatureValue) {
      newActions.light = {
        brightness: brightnessValue,
        temperature: temperatureValue,
      };

      delete newActions.luminance;
      delete newActions.brightness;
      delete newActions.temperature;
    }
  }

  return newActions;
};

exports.getAliasIds = (nickname, parentPath = '') => {
  if (parentPath.split('.').includes(nickname)) {
    const error = new Error('Circular device aliases');
    error.name = 'CIRCULAR_ALIAS';
    throw error;
  }

  const parentPathCopy = `${parentPath}.${nickname}`;
  const subDeviceInfo = deviceConfig[fn.slugify(nickname)] || {};
  return exports.getDeviceIdInfo(subDeviceInfo, parentPathCopy) || [];
};

exports.getDeviceIdInfo = (deviceInfo, parentPath = '') => {
  if (_.isPlainObject(deviceInfo)) {
    if (deviceInfo.mfg_id) {
      if (Array.isArray(deviceInfo.mfg_id)) {
        return deviceInfo.mfg_id.map((deviceId) => ({
          ...deviceInfo,
          id: deviceId,
        }));
      }

      return [{
        ...deviceInfo,
        mfg_id: deviceInfo.mfg_id,
      }];
    }
  }

  if (Array.isArray(deviceInfo)) {
    return deviceInfo.flatMap((nickname) => exports.getAliasIds(nickname, parentPath));
  }

  if (typeof deviceInfo === 'string') {
    return exports.getAliasIds(deviceInfo, parentPath);
  }

  return [];
};

exports.getDevices = async () => [
  ...(await exports.getTuyaDevices() || []), ...(await exports.getMerossDevices() || []),
];

exports.getMerossDevices = async () => Object.values(Devices).map(({ deviceDef }) => ({
  nickname: deviceDef.name,
  data: {
    online: true,
    state: true,
    light_state: {},
  },
  name: deviceDef.name,
  icon: null,
  id: deviceDef.mfg_id,
  dev_type: deviceDef.type,
  ha_type: deviceDef.type,
}));

exports.getTimeBasedActions = async ({ deviceIdInfo, deviceAction, deviceData }) => {
  if (deviceIdInfo.timeBased && deviceAction.timeBased !== false) {
    return Object.fromEntries(
      await Promise.all(Object.entries(deviceAction.actions).map(([action, value]) => (
        async ([action, value]) => {
          let actionSlug = fn.slugify(action);
          let valueCopy = value;
          if ((deviceIdInfo.timeBased[actionSlug] || (actionSlug === 'toggle' && deviceIdInfo.timeBased.on))) {
            let timeAction = actionSlug;
            if (actionSlug === 'toggle') {
              const isOn = exports.isOn(deviceData);
              if (!isOn) {
                timeAction = 'on';
              }
            }

            const timeBasedSchedules = deviceIdInfo.timeBased[timeAction];
            if (timeBasedSchedules) {
              let scheduledPresetConfigKey = Object.keys(timeBasedSchedules).find(
                (times) => {
                  const timesSplit = times.split('->');
                  const startTime = timesSplit[0];
                  const endTime = timesSplit[1];
                  return times !== 'default' && fn.isInTimeRange(startTime, endTime);
                },
              );

              if (!scheduledPresetConfigKey && Object.keys(timeBasedSchedules).includes('default')) {
                scheduledPresetConfigKey = 'default';
              }

              const scheduledPresetConfig = {
                times: scheduledPresetConfigKey,
                presetName: timeBasedSchedules[scheduledPresetConfigKey],
              };

              if (scheduledPresetConfig) {
                const presetSlug = fn.slugify(scheduledPresetConfig.presetName);
                const scheduledPreset = fn.slugifyKeys(deviceIdInfo.presets)[presetSlug];
                if (scheduledPreset) {
                  actionSlug = 'preset';
                  valueCopy = scheduledPresetConfig.presetName;
                }
              }
            }
          }
          return [actionSlug, valueCopy];
        })([action, value]))),
    );
  }

  return deviceAction.actions;
};

exports.getTuyaDevices = async () => tuyaAPI.find();

exports.isOn = (deviceData) => deviceData.Device.state;

exports.performDeviceAction = async (deviceData) => {
  const { Device } = deviceData;
  const successes = [];
  const errors = [];
  let totalActions = 0;
  if (Device) {
    if (!deviceData?.data?.online) {
      return {
        success: false,
        successes: [],
        errors: [{
          success: false,
          status: 500,
          error: 'DEVICE_OFFLINE',
          message: `Device ${Device.name} is offline`,
        }],
      };
    }

    const actionCallback = (response, action) => {
      const responseSuccess = _.get(response, 'header.code');
      if (responseSuccess === undefined) {
        if (_.isPlainObject(response)) {
          (response.success ? successes : errors).push(response);
        } else {
          errors.push(response);
        }
      } else if (responseSuccess) {
        successes.push({
          success: true,
          device: {
            ...deviceData,
            Device: Object.fromEntries(Object.entries(Device).filter(([key]) => key !== 'api')),
          },
        });
      } else {
        errors.push({
          success: false,
          status: 500,
          error: 'ACTION_UNSUCCESSFUL',
          message: `Action ${action} was not performed on ${Device.name}`,
          originalError: response?.originalError,
        });
      }
    };

    const actionValues = Object.entries(deviceData.actions);
    totalActions = actionValues.flatMap(([action, value]) => {
      if (action === 'preset') {
        const preset = fn.slugifyKeys(deviceData.presets)[fn.slugify(value)];
        if (preset) {
          if (typeof preset === 'string') {
            return [preset];
          }

          return Object.keys(exports.combineLightValueActions(preset, Device));
        }

        return [];
      }

      return action;
    }).length;

    await Promise.all(actionValues.map(([action, value]) => (async ([action, value]) => {
      switch (action) {
        case 'off': {
          Device.turnOff().then((response) => actionCallback(response, action));
          break;
        }

        case 'on': {
          Device.turnOn().then((response) => actionCallback(response, action));
          break;
        }

        case 'toggle': {
          Device.toggle().then((response) => actionCallback(response, action));
          break;
        }

        case 'light': {
          if (Device instanceof Bulb) {
            Device.setLightValues(value).then((response) => actionCallback(response, action));
          } else {
            errors.push({
              success: false,
              status: 400,
              error: 'ACTION_NOT_SUPPORTED',
              message: `Device ${Device.name} does not support action ${action}`,
            });
          }

          break;
        }

        case 'brightness':
          // falls through
        case 'luminance': {
          if (Device instanceof Bulb) {
            Device.setBrightness(value).then((response) => actionCallback(response, action));
          } else {
            errors.push({
              success: false,
              status: 400,
              error: 'ACTION_NOT_SUPPORTED',
              message: `Device ${Device.name} does not support action ${action}`,
            });
          }

          break;
        }

        case 'color': {
          if (Device instanceof Bulb) {
            Device.setColor(_.get(colors, [fn.slugify(value), 'value']) || value).then((response) => actionCallback(response, action));
          } else {
            errors.push({
              success: false,
              status: 400,
              error: 'ACTION_NOT_SUPPORTED',
              message: `Device ${Device.name} does not support action ${action}`,
            });
          }

          break;
        }

        case 'temperature': {
          if (Device instanceof Bulb) {
            if (Device instanceof Light || Device instanceof Bulb) {
              Device.setColorTemperature(value).then((response) => (
                actionCallback(response, action)));
            } else if (Device instanceof Climate || Device instanceof Thermostat) {
              Device.setTemperature(value).then((response) => actionCallback(response, action));
            }
          } else {
            errors.push({
              success: false,
              status: 400,
              error: 'ACTION_NOT_SUPPORTED',
              message: `Device ${Device.name} does not support action ${action}`,
            });
          }

          break;
        }

        case 'mode': {
          if (Device instanceof Thermostat) {
            Device.setOperationMode(value).then((response) => actionCallback(response, action));
          }

          break;
        }

        case 'preset': {
          // eslint-disable-next-line no-param-reassign
          deviceData.presets = fn.slugifyKeys(deviceData.presets);
          const presetName = fn.slugify(value);
          if (!presetName) {
            errors.push({
              success: false,
              status: 400,
              error: 'PRESET_REQUIRED',
              message: 'Preset value is required',
            });

            return;
          }

          let preset;
          if (value === '__next') {
            preset = Device.presets.next()?.actions;
          } else {
            if (!deviceData.presets || !deviceData.presets[presetName]) {
              logger.warn(`Preset not found: ${presetName} for device ${Device.name}`);
              errors.push({
                success: false,
                status: 404,
                error: 'PRESET_NOT_FOUND',
                message: `Cannot find preset ${presetName} for device ${Device.name}`,
              });

              return;
            }

            preset = deviceData.presets[presetName];
            if (typeof preset === 'string') {
              preset = {
                [preset]: true,
              };
            }
          }

          if (preset) {
            const presetDeviceData = {
              ...deviceData,
              actions: exports.combineLightValueActions(preset, Device),
            };

            exports.performDeviceAction(presetDeviceData).then((response) => {
              successes.push(...response.successes);
              errors.push(...response.errors);
            });
          } else {
            successes.push({
              success: true,
              device: {
                ...deviceData,
                Device: Object.fromEntries(Object.entries(Device).filter(([key]) => key !== 'api')),
              },
            });
          }

          break;
        }

        default: {
          logger.warn(`Action not found: ${action}`);
          errors.push({
            success: false,
            status: 404,
            error: 'ACTION_NOT_FOUND',
            message: `Cannot find action ${action}`,
          });
        }
      }
    })([action, value])));
  } else {
    logger.error('Device not defined');
    errors.push({
      success: false,
      status: 500,
      error: 'DEVICE_NOT_DEFINED',
      message: 'The device was not created properly',
    });
  }

  return fn.waitUntil(
    () => ((successes.length + errors.length) >= totalActions),
    () => ({ success: successes.length > 0, successes, errors }),
  );
};

exports.performDeviceActions = async (deviceActions) => {
  try {
    const errors = [];
    const successes = [];

    let totalDevices = 0;
    let deviceCounter = 0;

    const moreDeviceActions = [];

    const deviceActionsLoopCallback = async (deviceAction) => {
      const deviceActionCopy = _.cloneDeep(deviceAction);
      const deviceNickname = deviceActionCopy.nickname;

      if (deviceNickname.match(/^\*/)) {
        const deviceType = deviceNickname.match(/^\*(.*)/)[1].toLowerCase();
        moreDeviceActions.push(...fn.filterMap(Object.values(deviceConfig),
          (device) => (
            _.isPlainObject(device) && (!deviceType || device.type === deviceType)
          ),
          (device) => ({
            nickname: device.name,
            actions: deviceActionCopy.actions,
          })));
        return;
      }

      const deviceInfo = deviceConfig[fn.slugify(deviceNickname)] || {};
      let deviceIdsInfo = [];
      try {
        deviceIdsInfo = exports.getDeviceIdInfo(deviceInfo, deviceNickname);
        deviceIdsInfo = _.uniqBy(deviceIdsInfo, (deviceIdInfo) => `${deviceIdInfo.platform} - ${deviceIdInfo.id}`);
      } catch (error) {
        if (error.name === 'CIRCULAR_ALIAS') {
          errors.push({
            success: false,
            status: 400,
            error: error.name,
            message: `${error.message} for device ${deviceNickname}`,
          });

          return;
        }

        throw error;
      }

      if (!deviceIdsInfo || deviceIdsInfo.length === 0) {
        errors.push({
          success: false,
          status: 404,
          error: 'DEVICE_NOT_FOUND',
          message: `Cannot find device ${deviceNickname}`,
        });

        return;
      }

      totalDevices += deviceIdsInfo.length;

      await Promise.all(deviceIdsInfo.map((deviceIdInfo) => (async (deviceIdInfo) => {
        const deviceId = deviceIdInfo.mfg_id;
        const { Device } = Devices[deviceId];
        const { deviceDef } = Devices[deviceId];
        if (!Device) {
          errors.push({
            success: false,
            status: 500,
            error: 'DEVICE_TYPE_NOT_DEFINED',
            message: `Cannot match device type ${deviceDef.deviceType} to a class`,
          });

          deviceCounter += 1;
          return;
        }

        Device.lock = true;
        delay(7000).then(() => {
          Device.lock = false;
        });

        const deviceData = {
          nickname: deviceNickname,
          presets: deviceIdInfo.presets,
          info: deviceIdInfo,
          actions: {},
          Device,
          data: {
            online: Device.online,
            state: Device.state,
          },
        };

        if (Array.isArray(deviceActionCopy.actions)) {
          deviceActionCopy.actions = Object.fromEntries(deviceActionCopy.actions
            .map((action) => [action.action, action.value]));
        }

        deviceActionCopy.actions = await exports.getTimeBasedActions({
          deviceIdInfo,
          deviceAction: deviceActionCopy,
          deviceData,
        });

        Device.override = deviceActionCopy.timeBased !== false;

        deviceData.actions = exports.combineLightValueActions(deviceActionCopy.actions, Device);
        exports.performDeviceAction(deviceData).then((response) => {
          const responseArray = Array.isArray(response) ? [...response] : [response];
          responseArray.forEach((responseObj) => {
            if (responseObj.successes) {
              successes.push(...responseObj.successes);
            }
            if (responseObj.errors) {
              errors.push(...responseObj.errors);
            }
          });

          deviceCounter += 1;
        }).catch((error) => {
          logger.error(error);
        });
      })(deviceIdInfo)));
    };

    await deviceActions.forEach(deviceActionsLoopCallback);
    await moreDeviceActions.forEach(deviceActionsLoopCallback);

    return await fn.waitUntil(() => (deviceCounter >= totalDevices), () => {
      if (successes.length > 0) {
        return {
          success: true,
          status: 200,
          code: 0,
          succeeded: successes,
          ...(errors.length > 0 ? { failed: errors } : {}),
        };
      }

      if (errors.length > 0) {
        if (errors.length === 1) {
          return {
            code: 1,
            ...errors[0],
          };
        }

        const status = errors.find((error) => error.status < 500) ? 400 : 500;
        return {
          success: false,
          status,
          code: 1,
          failed: errors,
          error: errors.map((error) => error.error),
          message: errors.map((error) => error.message),
        };
      }

      return {
        success: false,
        status: 500,
        code: 2,
        error: 'SERVER_ERROR',
        message: 'An unexpected error occurred',
      };
    });
  } catch (error) {
    logger.error(error);
    return {
      success: false,
      status: 500,
      code: 3,
      error: 'SERVER_ERROR',
      message: 'An unexpected error occurred',
    };
  }
};

exports.reassignDeviceRoom = async (deviceIds, roomId) => {
  if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
    return;
  }

  const transaction = await sequelize.transaction();

  try {
    await models.Device.update({
      room_id: roomId,
    }, {
      where: {
        id: deviceIds,
      },
      transaction,
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  deviceIds.forEach((deviceId) => {
    const device = modelsBy.Device.id[deviceId][0];
    const currentRoomId = device.room_id;
    rooms.forEach((room) => {
      if (room.id === currentRoomId) {
        // eslint-disable-next-line no-param-reassign
        room.devices = room.devices.filter((device) => device.id !== deviceId);
      }

      if (room.id === roomId) {
        room.devices.push(fn.filterObjectProperties(device, constants.deviceProps));
      }
    });
  });

  Object.values(modelsBy.Device).forEach((deviceGroup) => {
    Object.values(deviceGroup).forEach((devices) => {
      devices.forEach((device) => {
        if (deviceIds.includes(device.id)) {
          // eslint-disable-next-line no-param-reassign
          device.room_id = roomId;
        }
      });
    });
  });

  if (!modelsBy.Device.room_id[roomId]) {
    global.modelsBy.Device.room_id[roomId] = deviceIds.map((deviceId) => (
      modelsBy.Device.id[deviceId][0]
    ));
  }

  await transaction.commit();

  global.deviceConfig = dataFn.getDeviceConfig(modelsBy);
};

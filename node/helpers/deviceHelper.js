const envVars = module.parent.parent.exports;

const {
  _,
  api,
  Bulb,
  Climate,
  colors,
  deviceConfig,
  deviceTypeClassMap,
  fetch,
  fn,
  fs,
  Light,
  merossFullURL,
  Thermostat,
} = envVars;

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
      if (deviceInfo.mfg_id._isArray()) {
        return deviceInfo.mfg_id._map((deviceId) => ({
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

  if (deviceInfo._isArray()) {
    return deviceInfo._flatMap((nickname) => exports.getAliasIds(nickname, parentPath));
  }

  if (typeof deviceInfo === 'string') {
    return exports.getAliasIds(deviceInfo, parentPath);
  }

  return [];
};

exports.getDevices = async () => [
  ...(await exports.getTuyaDevices() || []), ...(await exports.getMerossDevices() || []),
];

exports.getMerossDevices = async () => {
  const response = await (await fetch(`${merossFullURL}/devices`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })).text();

  try {
    return JSON.parse(response);
  } catch (error) {
    return [response];
  }
};

exports.getTuyaDevices = async () => api.find();

exports.isOn = async (deviceData) => deviceData.Device.isOn();

exports.performDeviceAction = async (devices, deviceData, fallback) => {
  const { Device } = deviceData;
  const successes = [];
  const errors = [];
  let totalActions = 0;
  if (Device) {
    if (!_.get(deviceData, 'data.online')) {
      return {
        success: false,
        successes: [],
        errors: [{
          success: false,
          status: 400,
          error: 'DEVICE_OFFLINE',
          message: `Device ${deviceData.nickname} is offline`,
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
          device: deviceData,
        });
      } else {
        errors.push({
          success: false,
          status: 500,
          error: 'ACTION_UNSUCCESSFUL',
          message: `Action ${action} was not performed on ${deviceData.nickname}`,
        });
      }
    };

    const actionValues = deviceData.actions._toPairs();
    totalActions = actionValues._flatMap(([action, value]) => {
      if (action === 'preset') {
        const preset = fn.slugifyKeys(deviceData.presets)[fn.slugify(value)];
        if (preset) {
          if (typeof preset === 'string') {
            return [preset];
          }

          return preset._keys();
        }

        return [];
      }

      return action;
    }).length;

    await actionValues._forEach(async ([action, value]) => {
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

        case 'brightness': {
          if (Device.supportsFeature('brightness')) {
            Device.setBrightness(value).then((response) => actionCallback(response, action));
          } else {
            errors.push({
              success: false,
              status: 400,
              error: 'ACTION_NOT_SUPPORTED',
              message: `Device ${deviceData.nickname} does not support action ${action}`,
            });
          }

          break;
        }

        case 'luminance': {
          if (Device.supportsFeature('brightness')) {
            Device.setBrightness(value).then((response) => actionCallback(response, action));
          } else {
            errors.push({
              success: false,
              status: 400,
              error: 'ACTION_NOT_SUPPORTED',
              message: `Device ${deviceData.nickname} does not support action ${action}`,
            });
          }

          break;
        }

        case 'color': {
          if (Device.supportsFeature('color')) {
            Device.setColor(_.get(colors, [fn.slugify(value), 'value']) || value).then((response) => actionCallback(response, action));
          } else {
            errors.push({
              success: false,
              status: 400,
              error: 'ACTION_NOT_SUPPORTED',
              message: `Device ${deviceData.nickname} does not support action ${action}`,
            });
          }

          break;
        }

        case 'temperature': {
          if (Device.supportsFeature('temperature')) {
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
              message: `Device ${deviceData.nickname} does not support action ${action}`,
            });
          }

          break;
        }

        case 'mode': {
          if (Device.supportsFeature('mode')) {
            if (Device instanceof Thermostat) {
              Device.setOperationMode(value).then((response) => actionCallback(response, action));
            }
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

          if (!deviceData.presets || !deviceData.presets[presetName]) {
            console.warn(`Preset not found: ${presetName} for device ${deviceData.nickname}`);
            errors.push({
              success: false,
              status: 404,
              error: 'PRESET_NOT_FOUND',
              message: `Cannot find preset ${presetName} for device ${deviceData.nickname}`,
            });

            return;
          }

          let preset = deviceData.presets[presetName];

          if (typeof preset === 'string') {
            preset = {
              [preset]: true,
            };
          }

          const presetDeviceData = {
            ...deviceData,
            actions: preset,
          };

          exports.performDeviceAction(devices, presetDeviceData, fallback).then((response) => {
            successes.push(...response.successes);
            errors.push(...response.errors);
          });

          break;
        }

        default: {
          console.warn(`Action not found: ${action}`);
          errors.push({
            success: false,
            status: 404,
            error: 'ACTION_NOT_FOUND',
            message: `Cannot find action ${action}`,
          });
        }
      }
    });
  } else {
    console.error('Device not defined');
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
    const actionList = deviceActions._flatMap((deviceAction) => {
      if (deviceAction.actions._isArray()) {
        return deviceAction.actions._map((actionObj) => actionObj.action);
      }

      if (_.isPlainObject(deviceAction.actions)) {
        return deviceAction.actions._keys();
      }

      return [];
    });

    let fallback = false;
    let devices = await exports.getDevices();
    if (devices) {
      fs.writeFileSync('./config/devices.json', JSON.stringify(devices));
    } else if (actionList.includes('toggle')) {
      fallback = true;
      // eslint-disable-next-line import/no-dynamic-require, import/no-unresolved, global-require
      devices = require('./config/devices.json'); // TODO stop using a file for this
    }

    const errors = [];
    const successes = [];

    let totalDevices = 0;
    let deviceCounter = 0;

    await deviceActions._forEach(async (deviceAction) => {
      const deviceActionCopy = _.cloneDeep(deviceAction);
      const deviceNickname = deviceActionCopy.nickname;
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

      await deviceIdsInfo._forEach(async (deviceIdInfo) => {
        const { platform } = deviceIdInfo;
        const deviceId = deviceIdInfo.mfg_id;
        let constructorParams = {};
        if (platform === 'tuya') {
          constructorParams = { api, deviceId };
        } else if (platform === 'meross') {
          constructorParams = { url: merossFullURL, deviceId };
        }

        const DeviceType = _.get(deviceTypeClassMap, [platform, deviceIdInfo.type], null);

        if (!DeviceType) {
          errors.push({
            success: false,
            status: 500,
            error: 'DEVICE_TYPE_NOT_DEFINED',
            message: `Cannot match device type ${deviceIdsInfo.type} to a class`,
          });

          deviceCounter += 1;
          return;
        }

        const Device = new DeviceType(constructorParams);
        const deviceData = {
          nickname: deviceNickname,
          presets: deviceIdInfo.presets,
          info: deviceIdInfo,
          actions: {},
          Device,
          ...(devices._find((device) => device.id === deviceId) || {}),
        };

        if (deviceActionCopy.actions._isArray()) {
          deviceActionCopy.actions = deviceActionCopy.actions
            ._map((action) => [action.action, action.value])
            ._fromPairs();
        }

        if (deviceIdInfo.timeBased) {
          deviceActionCopy.actions = (await deviceActionCopy.actions._map(
            async (value, action) => {
              let actionSlug = fn.slugify(action);
              let valueCopy = value;
              if ((deviceIdInfo.timeBased[actionSlug] || (actionSlug === 'toggle' && deviceIdInfo.timeBased.on))) {
                let timeAction = actionSlug;
                if (actionSlug === 'toggle') {
                  const isOn = await exports.isOn(deviceData);
                  if (!isOn) {
                    timeAction = 'on';
                  }
                }

                const timeBasedSchedules = deviceIdInfo.timeBased[timeAction];
                if (timeBasedSchedules) {
                  const scheduledPresetConfigKey = timeBasedSchedules._keys()._find(
                    (times) => {
                      const timesSplit = times.split('->');
                      const startTime = timesSplit[0];
                      const endTime = timesSplit[1];
                      return fn.isInTimeRange(startTime, endTime);
                    },
                  );

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
            },
          ))._fromPairs();
        }

        deviceData.actions = deviceActionCopy.actions;
        exports.performDeviceAction(devices, deviceData, fallback).then((response) => {
          const responseArray = response._isArray() ? [...response] : [response];
          responseArray._forEach((responseObj) => {
            if (responseObj.successes) {
              successes.push(...responseObj.successes);
            } else if (responseObj.errors) {
              errors.push(...responseObj.errors);
            }
          });

          deviceCounter += 1;
        }).catch((error) => {
          console.error(error);
        });
      });
    });

    return await fn.waitUntil(() => (deviceCounter >= totalDevices), () => {
      if (fallback) {
        fs.writeFileSync('./config/devices.json', JSON.stringify(devices));
      }

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

        const status = errors._find((error) => error.status < 500) ? 400 : 500;
        return {
          success: false,
          status,
          code: 1,
          failed: errors,
          error: errors._map((error) => error.error),
          message: errors._map((error) => error.message),
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
    console.error(error);
    return {
      success: false,
      status: 500,
      code: 3,
      error: 'SERVER_ERROR',
      message: 'An unexpected error occurred',
    };
  }
};

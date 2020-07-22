const _ = require('lodash');
const bodyParser = require('body-parser');
const CloudTuya = require('./cloudtuya');
const delay = require('delay');
const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const { getSunrise, getSunset } = require('sunrise-sunset-js');
const path = require('path');

const TuyaDevice = require('./devices/tuya/device');
const Climate = require('./devices/tuya/climate');
const Fan = require('./devices/tuya/fan');
const Light = require('./devices/tuya/light');

const MerossDevice = require('./devices/meross/device');
const Bulb = require('./devices/meross/bulb');
const Thermostat = require('./devices/meross/thermostat');
// todo add more device classes:
// const Plug = require('./devices/meross/plug');
// const Hub = require('./devices/meross/hub');
// const Humidifier = require('./devices/meross/humidier');
// const DoorOpener = require('./devices/meross/doorOpener');
// const Sensor = require('./devices/meross/sensor');

const app = express();
const port = 3030;
const merossURL = 'localhost';
const merossPort = 5000;
const merossFullURL = `http://${merossURL}:${merossPort}`;

const location = {
  lat: 40.307444,
  lng: -111.762306,
  timezone: 'America/Denver'
};

process.env.TZ = location.timezone;

let apiKeys = {};
let deviceConfig = {};
let scenes = {};

try {
  apiKeys = require('./keys.json');
} catch (err) {
  console.error('keys.json is missing.');
}

try {
  deviceConfig = require('./device_config.json');
} catch (err) {
  console.error(err);
  console.warn('device_config.json is missing. creating temporary');
  deviceConfig = {};
}

try {
  scenes = require('./scenes.json');
} catch (err) {
  console.error(err);
  console.warn('scenes.json is missing. creating temporary');
  scenes = {};
}

try {
  colors = require('./colors.json');
} catch (err) {
  console.error(err);
  console.warn('colors.json is missing. creating temporary');
  colors = {};
}

const deviceTypeClassMap = {
  'tuya': {
    'socket': TuyaDevice,
    'switch': TuyaDevice,
    'climate': Climate,
    'fan': Fan,
    'light': Light
  },
  'meross': {
    'bulb': Bulb,
    'thermostat': Thermostat
  }
};

const api = new CloudTuya({
  userName: apiKeys.userName,
  password: apiKeys.password,
  bizType: apiKeys.bizType,
  countryCode: apiKeys.countryCode,
  region: apiKeys.region,
});

api.login().then((tokens) => {
  console.log('Successfully authenticated with CloudTuya');
}).catch((error) => {
  console.error('Cannot authenticate with CloudTuya');
  console.error(error);
});

app.use(require('cookie-parser')());

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ extended: true }));

const fn = {};

fn.slugify = (string) => _.camelCase(`${string}`);

fn.slugifyKeys = (obj) => (
  Object.fromEntries(Object.entries(obj).map(([key, value]) => [fn.slugify(key), value]))
);

fn.slugifyValues = (obj) => (
  Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, fn.slugify(value)]))
);

fn.slugifyEntries = (obj) => (
  Object.fromEntries(Object.entries(obj).map(([key, value]) => [fn.slugify(key), fn.slugify(value)]))
);

fn.asyncArrayIterator = async (array, iterator, callback) => {
    const returnVal = array[iterator](callback);
    if (Array.isArray(returnVal)) {
      return await Promise.all(returnVal);
    }

    return returnVal;
};

fn.waitUntil = async (condition, callback) => {
  let checkCondition;
  while (!checkCondition) {
    checkCondition = condition;
    if (typeof condition === 'function') {
      checkCondition = condition();
    }
    await delay(50);
  }

  return typeof callback === 'function' ? callback() : callback;
};

fn.getMilliseconds = (timeString) => {
  const timeUnits = timeString.replace(/([a-z]+)/gi, '$1<!--DELIMITER-->').split('<!--DELIMITER-->');
  return timeUnits.map((timeUnit) => {
    const amount = parseInt(timeUnit.replace(/\D/g, ''));
    const unit = timeUnit.replace(/[^a-z]/gi, '');
    switch (unit) {
      case 'y': {
        return amount * 1000 * 60 * 60 * 24 * 365;
      }

      case 'M': {
        return amount * 1000 * 60 * 60 * 24 * 30;
      }

      case 'w': {
        return amount * 1000 * 60 * 60 * 24 * 7;
      }

      case 'd': {
        return amount * 1000 * 60 * 60 * 24;
      }

      case 'h': {
        return amount * 1000 * 60 * 60;
      }

      case 'm': {
        return amount * 1000 * 60;
      }

      case 's': {
        return amount * 1000;
      }

      case 'ms': {
        return amount;
      }

      default: {
        return '';
      }
    }
  }).filter((amount) => amount).reduce((a, b) => a + b, 0);
};

fn.parseTime = (timeString, suntimeDay = new Date()) => {
  const today = new Date();
  let date = new Date(today);
  if (timeString.match(/^sunrise/i)) {
    date = getSunrise(location.lat, location.lng, suntimeDay);
    const offset = timeString.replace(/sunrise/i, '');
    if (offset !== '') {
      const operator = offset.match(/^[\-\+]/)[0];
      const amount = offset.match(/(\d+[yMwdhms])/)[0];
      const offsetMilliseconds = fn.getMilliseconds(amount);
      if (operator === '+') {
        date.setTime(date.getTime() + offsetMilliseconds);
      } else if (operator === '-') {
        date.setTime(date.getTime() - offsetMilliseconds);
      }
    }
  } else if (timeString.match(/^sunset/i)) {
    date = getSunset(location.lat, location.lng, suntimeDay);
    const offset = timeString.replace(/sunset/i, '');
    if (offset !== '') {
      const operator = offset.match(/^[\-\+]/)[0];
      const amount = offset.match(/(\d+[yMwdhms])/)[0];
      const offsetMilliseconds = fn.getMilliseconds(amount);
      if (operator === '+') {
        date.setTime(date.getTime() + offsetMilliseconds);
      } else if (operator === '-') {
        date.setTime(date.getTime() - offsetMilliseconds);
      }
    }
  } else if (timeString.match(/\d{2}:\d{2}(?:\:\d{2})?/)) {
    let timeUnits = timeString.match(/(\d{2}):(\d{2})(\:\d{2})?/);
    const hours = parseInt(timeUnits[1] || '0');
    const minutes = parseInt(timeUnits[2] || '0');
    const seconds = parseInt(timeUnits[3] || '0');
    date.setHours(hours, minutes, seconds);
  } else if (timeString === 'default') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  } else {
    const error = new Error(`Invalid time ${timeString}`);
    error.name = 'INVALID_TIME';
    throw error;
  }

  return date;
};

fn.isInTimeRange = (startTime, endTime) => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  let start = startTime ? fn.parseTime(startTime, startTime.match(/^sunrise/i) ? today : tomorrow) : today;
  let end = endTime ? fn.parseTime(endTime, tomorrow) : tomorrow;
  return today >= start && today < end;
};

fn.getAliasIds = (nickname, parentPath = '') => {
  if (parentPath.split('.').includes(nickname)) {
    const error = new Error('Circular device aliases');
    error.name = 'CIRCULAR_ALIAS';
    throw error;
  }

  parentPath += `.${nickname}`;
  let subDeviceInfo = deviceConfig[fn.slugify(nickname)] || {};
  return fn.getDeviceIdInfo(subDeviceInfo, parentPath) || [];
};

fn.getDeviceIdInfo = (deviceInfo, parentPath = '') => {
  if (_.isPlainObject(deviceInfo)) {
    if (deviceInfo.ids) {
      if (Array.isArray(deviceInfo.ids)) {
        return deviceInfo.ids.map((deviceId) => ({
          ...deviceInfo,
          id: deviceId
        }));
      } else {
        return [{
          ...deviceInfo,
          id: deviceInfo.ids
        }];
      }
    }
  }

  if (Array.isArray(deviceInfo)) {
    return deviceInfo.flatMap((nickname) => {
      fn.getAliasIds(nickname, parentPath);
    });
  }

  if (typeof deviceInfo === 'string') {
    return fn.getAliasIds(deviceInfo, parentPath);
  }

  return [];
};

fn.isOn = async (deviceData) => {
  return await deviceData.device.isOn();
  // let isOn = false;
  // try {
  //   isOn = await deviceData.device.isOn();
  // } catch (error) {
  //   try {
  //     isOn = (await api.state({
  //       devId: deviceData.device.id,
  //     }))[deviceData.device.id];
  //   } catch (error) {
  //     isOn = _.get(deviceData, 'data.state') || false;
  //   }
  // }
};

fn.performDeviceAction = async (devices, deviceData, fallback) => {
  const device = deviceData.device;
  const successes = [];
  const errors = [];
  let totalActions = 0;
  if (device) {
    if (!_.get(deviceData, 'data.online')) {
      return {
        success: false,
        successes: [],
        errors: [{
          success: false,
          status: 400,
          error: 'DEVICE_OFFLINE',
          message: `Device ${deviceData.nickname} is offline`
        }]
      };
    }

    const actionCallback = (response) => {
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
          device: deviceData
        });
      } else {
        errors.push({
          success: false,
          status: 500,
          error: 'ACTION_UNSUCCESSFUL',
          message: `Action ${action} was not performed on ${deviceData.nickname}`
        });
      }
    };

    const actionValues = Object.entries(deviceData.actions);
    totalActions = actionValues.flatMap(([action, value]) => {
      if (action === 'preset') {
        let preset = fn.slugifyKeys(deviceData.presets)[fn.slugify(value)];
        if (preset) {
          if (typeof preset === 'string') {
            return [preset];
          }

          return Object.keys(preset);
        }

        return [];
      }

      return action;
    }).length;

    await fn.asyncArrayIterator(actionValues, 'forEach', async ([action, value]) => {
      switch (action) {
        case 'off': {
          device.turnOff().then(actionCallback);
          break;
        }

        case 'on': {
          device.turnOn().then(actionCallback);
          break;
        }

        case 'toggle': {
          device.toggle().then(actionCallback);
          break;
        }

        case 'brightness': {
          if (device.supportsFeature('brightness')) {
            device.setBrightness(value).then(actionCallback);
          } else {
            errors.push({
              success: false,
              status: 400,
              error: 'ACTION_NOT_SUPPORTED',
              message: `Device ${deviceData.nickname} does not support action ${action}`
            });
          }

          break;
        }

        case 'luminance': {
          if (device.supportsFeature('brightness')) {
            device.setBrightness(value).then(actionCallback);
          } else {
            errors.push({
              success: false,
              status: 400,
              error: 'ACTION_NOT_SUPPORTED',
              message: `Device ${deviceData.nickname} does not support action ${action}`
            });
          }

          break;
        }

        case 'color': {
          if (device.supportsFeature('color')) {
            device.setColor(colors[fn.slugify(value)] || value).then(actionCallback);
          } else {
            errors.push({
              success: false,
              status: 400,
              error: 'ACTION_NOT_SUPPORTED',
              message: `Device ${deviceData.nickname} does not support action ${action}`
            });
          }

          break;
        }

        case 'temperature': {
          if (device.supportsFeature('temperature')) {
            if (device instanceof Light || device instanceof Bulb) {
              device.setColorTemperature(value).then(actionCallback);
            } else if (device instanceof Climate || device instanceof Thermostat) {
              device.setTemperature(value).then(actionCallback);
            }
          } else {
            errors.push({
              success: false,
              status: 400,
              error: 'ACTION_NOT_SUPPORTED',
              message: `Device ${deviceData.nickname} does not support action ${action}`
            });
          }

          break;
        }

        case 'mode': {
          if (device.supportsFeature('mode')) {
            if (device instanceof Thermostat) {
              device.setOperationMode(value).then(actionCallback);
            }
          }

          break;
        }

        case 'preset': {
          deviceData.presets = fn.slugifyKeys(deviceData.presets);
          const presetName = fn.slugify(value);
          if (!presetName) {
            errors.push({
              success: false,
              status: 400,
              error: 'PRESET_REQUIRED',
              message: 'Preset value is required'
            });

            return;
          }

          if (!deviceData.presets || !deviceData.presets[presetName]) {
            console.warn(`Preset not found: ${presetName} for device ${deviceData.nickname}`);
            errors.push({
              success: false,
              status: 404,
              error: 'PRESET_NOT_FOUND',
              message: `Cannot find preset ${presetName} for device ${deviceData.nickname}`
            });

            return;
          }

          let preset = deviceData.presets[presetName];

          if (typeof preset === 'string') {
            preset = {
              [preset]: true
            };
          }

          const presetDeviceData = {
            ...deviceData,
            actions: preset
          };

        	fn.performDeviceAction(devices, presetDeviceData, fallback).then((response) => {
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
            message: `Cannot find action ${action}`
          });

          return;
        }
      }
    });
  } else {
    console.error(`Device not declared - nickname: ${deviceData.nickname}, id: ${deviceData.device.id}`);
    errors.push({
      success: false,
      status: 500,
      error: 'DEVICE_NOT_DEFINED',
      message: `The device was not created properly`
    });
  }

  return fn.waitUntil(() => ((successes.length + errors.length) >= totalActions), () => ({ success: successes.length > 0, successes, errors }));
};

fn.getTuyaDevices = async () => await api.find();

fn.getMerossDevices = async () => {
  const response = await (await fetch(`http://${merossURL}:${merossPort}/devices`, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  })).text();

  try {
    return JSON.parse(response);
  } catch (error) {
    return [response];
  }
};

fn.getDevices = async () => [...(await fn.getTuyaDevices() || []), ...(await fn.getMerossDevices() || [])];

deviceConfig = fn.slugifyKeys(deviceConfig);
scenes = fn.slugifyKeys(scenes);
colors = fn.slugifyKeys(colors);

const performDeviceActions = async (deviceActions) => {
  try {
    fallback = false;
    let devices = await fn.getDevices();
    if (devices) {
      fs.writeFileSync('./devices.json', JSON.stringify(devices));
    } else if (actionList.includes('toggle')) {
      fallback = true;
      devices = require('./devices.json');
    }

    const errors = [];
    const successes = [];

    let totalDevices = 0;
    let deviceCounter = 0;

    await fn.asyncArrayIterator(deviceActions, 'forEach', async (deviceAction) => {
      const deviceNickname = deviceAction.nickname;
      const deviceInfo = deviceConfig[fn.slugify(deviceNickname)] || {};
      let deviceIdsInfo = [];
      try {
        deviceIdsInfo = fn.getDeviceIdInfo(deviceInfo, deviceNickname);
        deviceIdsInfo = _.uniqBy(deviceIdsInfo, (deviceIdInfo) => `${deviceIdInfo.platform} - ${deviceIdInfo.id}`);
      } catch (error) {
        if (error.name = 'CIRCULAR_ALIAS') {
          errors.push({
            success: false,
            status: 400,
            error: error.name,
            message: `${error.message} for device ${deviceNickname}`
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
          message: `Cannot find device ${deviceNickname}`
        });

        return;
      }

      totalDevices += deviceIdsInfo.length;

      await fn.asyncArrayIterator(deviceIdsInfo, 'forEach', async (deviceIdInfo) => {
        const platform = deviceIdInfo.platform;
        const deviceId = deviceIdInfo.id;
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
            message: `Cannot match device type ${deviceIdsInfo.type} to a class`
          });

          deviceCounter += 1;
          return;
        }

        const device = new DeviceType(constructorParams);
        let deviceData = {
          nickname: deviceNickname,
          presets: deviceIdInfo.presets,
          info: deviceIdInfo,
          actions: {},
          device,
          ...(devices.find((device) => device.id === deviceId) || {})
        };

        if (deviceIdInfo.timeBased) {
          deviceAction.actions = Object.fromEntries(
            await (fn.asyncArrayIterator(Object.entries(deviceAction.actions), 'map', async ([action, value], index) => {
            if ((deviceIdInfo.timeBased[action] || (action === 'toggle' && deviceIdInfo.timeBased.on))) {
              let timeAction = action;
              if (action === 'toggle') {
                const isOn = await fn.isOn(deviceData);
                if (!isOn) {
                  timeAction = 'on';
                }
              }

              const timeBasedSchedules = deviceIdInfo.timeBased[timeAction];
              if (timeBasedSchedules) {
                let scheduledPresetConfig = Object.entries(timeBasedSchedules).find(([times, presetName]) => {
                  const timesSplit = times.split('->');
                  const startTime = timesSplit[0];
                  const endTime = timesSplit[1];
                  return fn.isInTimeRange(startTime, endTime)
                });

                scheduledPresetConfig = {
                  times: scheduledPresetConfig[0],
                  presetName: scheduledPresetConfig[1]
                };

                if (scheduledPresetConfig) {
                  const scheduledPreset = fn.slugifyKeys(deviceIdInfo.presets)[fn.slugify(scheduledPresetConfig.presetName)];
                  if (scheduledPreset) {
                    action = 'preset';
                    value = scheduledPresetConfig.presetName;
                  }
                }
              }
            }
            return [action, value];
          })));
        }

        deviceData.actions = deviceAction.actions;
        fn.performDeviceAction(devices, deviceData, fallback).then((response) => {
          if (!Array.isArray(response)) {
            response = [response];
          }

          response.forEach((responseObj) => {
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
        fs.writeFileSync('./devices.json', JSON.stringify(devices));
      }

      if (successes.length > 0) {
        return {
          success: true,
          status: 200,
          code: 0,
          succeeded: successes,
          ...(errors.length > 0 ? { failed: errors } : {})
        };
      }

      if (errors.length > 0) {
        if (errors.length === 1) {
          return {
            code: 1,
            ...errors[0]
          };
        }

        const status = errors.find((error) => error.status < 500) ? 400 : 500;
        return {
          success: false,
          status: status,
          code: 1,
          failed: errors,
          error: errors.map((error) => error.error),
          message: errors.map((error) => error.message)
        };
      }

      return {
        success: false,
        status: 500,
        code: 2,
        error: 'SERVER_ERROR',
        message: 'An unexpected error occurred'
      };
    });
  } catch (error) {
    console.error(error);
    return {
      success: false,
      status: 500,
      code: 3,
      error: 'SERVER_ERROR',
      message: 'An unexpected error occurred'
    };
  }
};

app.post('/device/action', async (req, res) => {
  const deviceActions = req.body;

  const response = await performDeviceActions(deviceActions);

  return res.status(response.status).json(response);
});

app.post('/scene/:sceneName', async (req, res) => {
  const sceneName = fn.slugify(req.params.sceneName);
  if (!scenes[sceneName]) {
    res.status(404).json({
      success: false,
      status: 404,
      error: 'SCENE_NOT_FOUND',
      message: `Cannot find scene ${sceneName}`
    });
  }

  const deviceActions = Object.entries(scenes[sceneName]).map(([deviceNickname, presetName]) => {
    const deviceInfo = deviceConfig[fn.slugify(deviceNickname)] || {};
    const deviceIdsInfo = fn.getDeviceIdInfo(deviceInfo, deviceNickname);
    let actions = _.get(deviceIdsInfo, [0, 'presets', presetName], { [presetName]: true });
    actions = typeof actions === 'string' ? { [actions]: true } : actions;
    return {
      nickname: deviceNickname,
      actions
    };
  });

  const response = await performDeviceActions(deviceActions);
  return response && response.status ? res.status(response.status).json(response) : res.json(response);
});

app.listen(port, () => console.log(`Smart Home REST Server started on port: ${port}`));

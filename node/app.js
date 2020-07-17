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
const Plug = require('./devices/meross/plug');
const Hub = require('./devices/meross/hub');
const Humidifier = require('./devices/meross/humidier');
const DoorOpener = require('./devices/meross/doorOpener');
const Sensor = require('./devices/meross/sensor');
const Thermostat = require('./devices/meross/thermostat');

const app = express();
const port = 3030;
const merossURL = 'localhost';
const merossPort = 5000;

const location = {
  lat: 40.307444,
  lng: -111.762306,
  timezone: 'America/Denver'
};

process.env.TZ = location.timezone;

let apiKeys = {};
let deviceNicknames = {};
let scenes = {};

try {
  apiKeys = require('./keys.json');
} catch (err) {
  console.error('keys.json is missing.');
}

try {
  deviceNicknames = require('./device_nicknames.json');
} catch (err) {
  console.error(err);
  console.warn('device_nicknames.json is missing. creating temporary');
  deviceNicknames = {};
}

try {
  scenes = require('./scenes.json');
} catch (err) {
  console.error(err);
  console.warn('scenes.json is missing. creating temporary');
  scenes = {};
}

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
  let start = fn.parseTime(startTime, today);
  let end = fn.parseTime(endTime, tomorrow);
  return today >= start && today < end;
};

fn.getAliasIds = (nickname, parentPath = '') => {
  if (parentPath.split('.').includes(nickname)) {
    const error = new Error('Circular device aliases');
    error.name = 'CIRCULAR_ALIAS';
    throw error;
  }

  parentPath += `.${nickname}`;
  let subDeviceInfo = deviceNicknames[fn.slugify(nickname)] || {};
  return fn.getDeviceIds(subDeviceInfo, parentPath) || [];
};

fn.getDeviceIds = (deviceInfo, parentPath = '') => {
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

fn.isOn = (deviceData) => {
  let isOn = false;
  try {
    isOn = await deviceData.Device.isOn();
  } catch (error) {
    try {
      isOn = (await api.state({
        devId: deviceData.Device.id,
      }))[deviceData.Device.id];
    } catch (error) {
      isOn = _.get(deviceData, 'data.state') || false;
    }
  }
};

fn.performDeviceAction = async (devices, deviceData, action, value, fallback) => {
  if (deviceData.Device) {
    if (!_.get(deviceData, 'data.online')) {
      return {
        success: false,
        status: 400,
        error: 'DEVICE_OFFLINE',
        message: `Device ${deviceData.nickname} is offline`
      };
    }

    switch (action) {
      case 'off': {
        deviceData.Device.turnOff();
        break;
      }

      case 'on': {
        deviceData.Device.turnOn();
        break;
      }

      case 'toggle': {
        const isOn = fn.isOn(deviceData);

        if (fallback) {
          for (let device of devices) {
            if (device.id === deviceData.Device.id) {
              device.data.state = !isOn;
            }
          }
        }

        if (isOn) {
          deviceData.Device.turnOff();
        } else {
          deviceData.Device.turnOn();
        }

        break;
      }

      case 'preset': {
        deviceData.presets = fn.slugifyKeys(deviceData.presets);
        const presetName = fn.slugify(value);
        if (!presetName) {
          return {
            success: false,
            status: 400,
            error: 'PRESET_REQUIRED',
            message: 'Preset value is required'
          };
        }

        if (!deviceData.presets || !deviceData.presets[presetName]) {
          console.warn(`Preset not found: ${presetName} for device ${deviceData.nickname}`);
          return {
            success: false,
            status: 404,
            error: 'PRESET_NOT_FOUND',
            message: `Cannot find preset ${presetName} for device ${deviceData.nickname}`
          };
        }

        let preset = deviceData.presets[presetName];

        if (typeof preset === 'string') {
          preset = [{
            action: preset,
            value: null
          }];
        } else if (_.isPlainObject(preset)) {
          preset = Object.entries(preset).map(([action, value]) => ({
            action,
            value
          }));
        }

        return await Promise.all(preset.map(async (presetAction) => {
        	return await fn.performDeviceAction(devices, deviceData, presetAction.action, presetAction.value, fallback);
        }));

        break;
      }

      default: {
        console.warn(`Action not found: ${action}`);
        return {
          success: false,
          status: 404,
          error: 'ACTION_NOT_FOUND',
          message: `Cannot find action ${action}`
        };
      }
    }
  } else {
    console.error(`Device not declared - nickname: ${deviceData.nickname}, id: ${deviceData.Device.id}`);
    return {
      success: false,
      status: 500,
      error: 'DEVICE_NOT_DEFINED',
      message: `The device was not created properly`
    };
  }

  return { success: true, device: deviceData };
};

fn.merossRequest = async (deviceId, devicePresets, action, queryParams) => {
  let queryParamsCopy = _.cloneDeep(queryParams);
  if (action === 'preset') {
    devicePresets = fn.slugifyKeys(devicePresets);
    const presetName = fn.slugify(queryParamsCopy.value);
    if (!presetName) {
      return {
        success: false,
        status: 400,
        error: 'PRESET_REQUIRED',
        message: 'Preset value is required'
      };
    }

    if (!devicePresets || !devicePresets[presetName]) {
      console.warn(`Preset not found: ${presetName} for device ${deviceNickname}`);
      return {
        success: false,
        status: 404,
        error: 'PRESET_NOT_FOUND',
        message: `Cannot find preset ${presetName} for device ${deviceNickname}`
      };
    }

    let preset = devicePresets[presetName];

    if (typeof preset === 'string') {
      preset = [{
        action: preset,
        value: null
      }];
    } else if (_.isPlainObject(preset)) {
      preset = Object.entries(preset).map(([action, value]) => ({
        action,
        value
      }));
    }

    return await Promise.all(preset.map(async (presetAction) => {
    	return await fn.merossRequest(deviceId, devicePresets, presetAction.action, {
        ...queryParamsCopy,
        value: presetAction.value
      });
    }));
  }

  if (action === 'color') {
    queryParamsCopy = {
      ...queryParamsCopy,
      value: typeof queryParamsCopy.value === 'string' ? queryParamsCopy.value.replace(/^#/, '') : queryParamsCopy.value
    }
  }

  const queryString = Object.entries(queryParamsCopy).map(([key, value]) => `${encodeURI(key)}=${encodeURI(value)}`).join('&');
  return fetch(`http://${merossURL}:${merossPort}/device/${deviceId}/${action}?${queryString}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
  }).then((response) => response.text().then((text) => {
    try {
      return JSON.parse(text);
    } catch (error) {
      return text;
    }
  }));
};

deviceNicknames = fn.slugifyKeys(deviceNicknames);
scenes = fn.slugifyKeys(scenes);

const performDeviceActions = async (deviceNicknamesList, action, value, queryParams = null) => {
  try {
    fallback = false;
    let devices = await api.find();
    if (devices) {
      fs.writeFileSync('./devices.json', JSON.stringify(devices));
    } else if (['toggle'].includes(action)) {
      fallback = true;
      devices = require('./devices.json');
    }

    const errors = [];
    const successes = [];

    let totalDevices = 0;
    let deviceCounter = 0;

    deviceNicknamesList.forEach((deviceNickname) => {
      const deviceInfo = deviceNicknames[fn.slugify(deviceNickname)] || {};
      let deviceIdsInfo = [];
      try {
        deviceIdsInfo = fn.getDeviceIds(deviceInfo, deviceNickname);
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

      const performActionCallback = (response) => {
        if (!Array.isArray(response)) {
          response = [response];
        }
        response.forEach((responseObj) => {
          if (responseObj.success) {
            successes.push(responseObj);
          } else {
            errors.push(responseObj);
          }
        });

        deviceCounter += 1;
      };

      deviceIdsInfo.forEach((deviceIdInfo) => {
        const platform = deviceIdInfo.platform;
        const deviceId = deviceIdInfo.id;
        const Device = platform === 'tuya' ? new TuyaDevice({ api, deviceId }) : {};
        let deviceData = {
          nickname: deviceNickname,
          presets: deviceIdInfo.presets,
          info: deviceIdInfo,
          Device
        };

        if (deviceIdInfo.timeBased && deviceIdInfo.timeBased[action]) {
          if (action === 'toggle') {
            if (platform === 'tuya') {
              const deviceData = {
                ...(devices.find((device) => device.id === deviceId) || {}),
                ...deviceData
              };

              if (deviceData) {
                const isOn = fn.isOn(deviceData);
              }
            }
          }

          const timeBasedSchedules = deviceIdInfo.timeBased[action];
          const scheduledPresetConfig = Object.entries(timeBasedSchedules).find(([times, presetName]) => {
            const timesSplit = times.split('->');
            const startTime = timesSplit[0];
            const endTime = timesSplit[1];
            return fn.isInTimeRange(startTime, endTime)
          });

          if (scheduledPresetConfig) {
            const scheduledPreset = fn.slugifyKeys(deviceIdInfo.presets)[fn.slugify(scheduledPresetConfig[1])];
            if (scheduledPreset) {
              action = 'preset';
              value = scheduledPresetConfig[1];
              queryParams.value = value;
            }
          }
        }

        // todo figure out how to conditionally toggle a preset (if off)

        if (platform === 'tuya') {
          fn.performDeviceAction(devices, deviceData, action, value, fallback).then(performActionCallback).catch((error) => {
            console.error(error);
          });
        } else if (platform === 'meross') {
          fn.merossRequest(deviceId, deviceIdInfo.presets, action, queryParams).then(performActionCallback).catch((error) => {
            console.error(error);
          });
        }
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

app.post('/device/:deviceNicknameList/:action', async (req, res) => {
  const deviceNicknamesList = req.params.deviceNicknameList.split(',');
  const { action } = req.params;
  const value = req.query.value;

  const response = await performDeviceActions(deviceNicknamesList, action, value, req.query);

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

  const devicePresets = _.groupBy(Object.keys(scenes[sceneName]), (deviceNickname) => {
    return scenes[sceneName][deviceNickname];
  });

  const numDevicePresets = Object.keys(devicePresets).length;

  const responses = [];

  Object.entries(devicePresets).forEach(([presetName, deviceNicknamesList]) => {
    const queryParams = {
      ...req.query,
      value: presetName
    };

    performDeviceActions(deviceNicknamesList, 'preset', presetName, queryParams).then((response) => {
      responses.push(response);
    });
  });

  return fn.waitUntil(() => (responses.length === numDevicePresets), () => (res.json(responses)));
});

app.listen(port, () => console.log(`Smart Home REST Server started on port: ${port}`));

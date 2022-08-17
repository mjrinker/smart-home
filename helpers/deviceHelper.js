const constants = require('./constants');
const groupHelper = require('./groupHelper');

const {
  _,
  Bulb,
  Climate,
  dataFn,
  delay,
  Devices,
  fn,
  Light,
  logger,
  models,
  sequelize,
  Thermostat,
  tuyaAPI,
} = global;

const hex2Digits = (hexd) => (hexd.length === 1 ? `0${hexd}` : hexd);

const rgbToHex = (r, g, b) => {
  const red = hex2Digits(r.toString(16));
  const green = hex2Digits(g.toString(16));
  const blue = hex2Digits(b.toString(16));
  return red + green + blue;
};

const blendColors = (percent, colors) => {
  const colorInts = colors.map((color) => Number.parseInt(color, 16));
  const left = Math.max(Math.floor(percent * (colorInts.length - 1)), 0);
  const right = Math.min(Math.ceil(percent * (colorInts.size - 1)), colorInts.length - 1);
  const colorLeft = colorInts[left];
  const colorRight = colorInts[right];

  /* eslint-disable no-bitwise */
  const leftR = ((colorLeft >> 16) & 0xff);
  const leftG = ((colorLeft >> 8) & 0xff);
  const leftB = (colorLeft & 0xff);

  const rightR = ((colorRight >> 16) & 0xff);
  const rightG = ((colorRight >> 8) & 0xff);
  const rightB = (colorRight & 0xff);
  /* eslint-enable no-bitwise */

  const step = 1 / (colorInts.length - 1);
  const percentRight = (percent - left * step) / step;
  const percentLeft = 1 - percentRight;

  const red = Math.floor((leftR * percentLeft + rightR * percentRight));
  const green = Math.floor((leftG * percentLeft + rightG * percentRight));
  const blue = Math.floor((leftB * percentLeft + rightB * percentRight));

  return rgbToHex(red, green, blue);
};

exports.getShortPresetActionsByDeviceId = async ({
  deviceIds,
  roomIds,
  groupIds,
  deviceIdsByRoomId,
  deviceIdsByGroupId,
}) => {
  const numericDeviceIds = deviceIds.map((id) => Number(id));
  const numericRoomIds = roomIds.map((id) => Number(id));
  const numericGroupIds = groupIds.map((id) => Number(id));

  const allPresets = await dataFn.findAll('Preset', [
    {
      model: 'device',
      model_id: numericDeviceIds,
    },
    {
      model: 'room',
      model_id: numericRoomIds,
    },
    {
      model: 'group',
      model_id: numericGroupIds,
    },
  ]);

  const allPresetActions = await dataFn.findAll('PresetAction', { preset_id: allPresets.map((preset) => preset.id) });

  const presetShortActionsByPresetId = Object.fromEntries(
    Object.entries(_.groupBy(allPresetActions, 'preset_id')).map(([presetId, presetActions]) => [
      presetId,
      Object.fromEntries(
        presetActions.map((presetAction) => (
          [
            presetAction.action,
            fn.castActionValue(presetAction.value, presetAction.datatype),
          ]
        )),
      ),
    ]),
  );

  const presetsByDeviceId = _.groupBy(allPresets.filter((preset) => preset.model === 'device'), 'model_id');
  const presetsByRoomId = _.groupBy(allPresets.filter((preset) => preset.model === 'room'), 'model_id');
  const presetsByGroupId = _.groupBy(allPresets.filter((preset) => preset.model === 'group'), 'model_id');

  Object.entries(deviceIdsByRoomId).forEach(([roomId, deviceIds]) => {
    deviceIds.forEach((deviceId) => {
      presetsByDeviceId[deviceId] = _.uniqBy([
        ...presetsByDeviceId[deviceId] || [],
        ...presetsByRoomId[roomId] || [],
      ], 'id');
    });
  });

  Object.entries(deviceIdsByGroupId).forEach(([groupId, deviceIds]) => {
    deviceIds.forEach((deviceId) => {
      presetsByDeviceId[deviceId] = _.uniqBy([
        ...presetsByDeviceId[deviceId] || [],
        ...presetsByGroupId[groupId] || [],
      ], 'id');
    });
  });

  return Object.fromEntries(Object.entries(presetsByDeviceId).map(([deviceId, presets]) => (
    [
      deviceId,
      Object.fromEntries(presets.map((preset) => (
        [preset.name, presetShortActionsByPresetId[preset.id]]
      ))),
    ]
  )));
};

exports.getConditionalActionsByDeviceId = async ({
  deviceIds,
  roomIds,
  groupIds,
  deviceIdsByRoomId,
  deviceIdsByGroupId,
}) => {
  const numericDeviceIds = deviceIds.map((id) => Number(id));
  const numericRoomIds = roomIds.map((id) => Number(id));
  const numericGroupIds = groupIds.map((id) => Number(id));
  const conditionalActions = await dataFn.findAll('ConditionalAction', [
    {
      model: 'device',
      model_id: numericDeviceIds,
    },
    {
      model: 'room',
      model_id: numericRoomIds,
    },
    {
      model: 'group',
      model_id: numericGroupIds,
    },
  ]);

  const presets = await dataFn.findAll('Preset', { id: conditionalActions.map((conditionalAction) => conditionalAction.preset_id) });

  const presetsById = _.keyBy(presets, 'id');

  const conditionalActionsByDeviceId = _.groupBy(
    conditionalActions.filter((conditionalAction) => conditionalAction.model === 'device'),
    'model_id',
  );

  const conditionalActionsByRoomId = _.groupBy(
    conditionalActions.filter((conditionalAction) => conditionalAction.model === 'room'),
    'model_id',
  );

  const conditionalActionsByGroupId = _.groupBy(
    conditionalActions.filter((conditionalAction) => conditionalAction.model === 'group'),
    'model_id',
  );

  Object.entries(deviceIdsByRoomId).forEach(([roomId, deviceIds]) => {
    deviceIds.forEach((deviceId) => {
      conditionalActionsByDeviceId[deviceId] = _.uniqBy([
        ...conditionalActionsByDeviceId[deviceId] || [],
        ...conditionalActionsByRoomId[roomId] || [],
      ], 'id');
    });
  });

  Object.entries(deviceIdsByGroupId).forEach(([groupId, deviceIds]) => {
    deviceIds.forEach((deviceId) => {
      conditionalActionsByDeviceId[deviceId] = _.uniqBy([
        ...conditionalActionsByDeviceId[deviceId] || [],
        ...conditionalActionsByGroupId[groupId] || [],
      ], 'id');
    });
  });

  return Object.fromEntries(Object.entries(conditionalActionsByDeviceId).map(([deviceId, conditionalActions]) => ([
    deviceId,
    Object.fromEntries(Object.entries(_.groupBy(conditionalActions, 'condition_type')).map(([conditionType, conditionalActions]) => ([
      conditionType,
      Object.fromEntries(Object.entries(_.groupBy(conditionalActions, 'action')).map(([actionName, conditionalActions]) => ([
        actionName,
        Object.fromEntries(conditionalActions.map((conditionalAction) => ([
          conditionalAction.condition ?? 'default',
          presetsById[conditionalAction.preset_id]?.name,
        ]))),
      ]))),
    ]))),
  ])));
};

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

// exports.getAliasIds = (nickname, parentPath = '') => {
//   if (parentPath.split('.').includes(nickname)) {
//     const error = new Error('Circular device aliases');
//     error.name = 'CIRCULAR_ALIAS';
//     throw error;
//   }
//
//   const parentPathCopy = `${parentPath}.${nickname}`;
//   const subDeviceInfo = deviceConfig[fn.slugify(nickname)] || {};
//   return exports.getDeviceIdInfo(subDeviceInfo, parentPathCopy) || [];
// };
//
// exports.getDeviceIdInfo = (deviceInfo, parentPath = '') => {
//   if (_.isPlainObject(deviceInfo)) {
//     if (deviceInfo.mfg_id) {
//       if (Array.isArray(deviceInfo.mfg_id)) {
//         return deviceInfo.mfg_id.map((deviceId) => ({
//           ...deviceInfo,
//           id: deviceId,
//         }));
//       }
//
//       return [{
//         ...deviceInfo,
//         mfg_id: deviceInfo.mfg_id,
//       }];
//     }
//   }
//
//   if (Array.isArray(deviceInfo)) {
//     return deviceInfo.flatMap((nickname) => exports.getAliasIds(nickname, parentPath));
//   }
//
//   if (typeof deviceInfo === 'string') {
//     return exports.getAliasIds(deviceInfo, parentPath);
//   }
//
//   return [];
// };

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

exports.getTimeBasedActions = async ({ conditionalActions, deviceAction, deviceData }) => {
  if (conditionalActions.time && deviceAction.time !== false) {
    return Object.fromEntries(
      await Promise.all(Object.entries(deviceAction.actions).map(([action, value]) => (
        async ([action, value]) => {
          let actionSlug = fn.slugify(action);
          let valueCopy = value;
          if ((conditionalActions.time[actionSlug] || (actionSlug === 'toggle' && conditionalActions.time.on))) {
            let timeAction = actionSlug;
            if (actionSlug === 'toggle') {
              const isOn = exports.isOn(deviceData);
              if (!isOn) {
                timeAction = 'on';
              }
            }

            const timeBasedSchedules = conditionalActions.time[timeAction];
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
                const scheduledPreset = fn.slugifyKeys(deviceData.presets)[presetSlug];
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
      const responseSuccess = response?.header?.code;
      if (responseSuccess === undefined) {
        if (_.isPlainObject(response) && response?.success) {
          Device.state = action === 'toggle' ? !Device.state : action !== 'off';
          successes.push(response);
        } else {
          errors.push(response);
        }
      } else if (responseSuccess) {
        Device.state = action === 'toggle' ? !Device.state : action !== 'off';
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

    const actionValues = Object.entries(deviceData.actions).map(([action, value]) => ([action.toLowerCase(), value]));
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
          if (Device instanceof Light || Device instanceof Bulb) {
            const color = await dataFn.findOne('Color', { name: fn.slugify(value.color) });
            const lightValues = {
              ...value,
              color: value?.color
                ? color?.value || value.color
                : undefined,
            };
            Device.setLightValues(lightValues).then((response) => actionCallback(response, action));
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
          if (Device instanceof Light || Device instanceof Bulb) {
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
          const color = await dataFn.findOne('Color', { name: fn.slugify(value.color) });
          if (Device instanceof Light || Device instanceof Bulb) {
            Device.setColor(color?.value || value)
              .then((response) => actionCallback(response, action));
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
          if (Device instanceof Light || Device instanceof Bulb) {
            Device.setColorTemperature(value).then((response) => (
              actionCallback(response, action)));
          } else if (Device instanceof Climate || Device instanceof Thermostat) {
            Device.setTemperature(value).then((response) => actionCallback(response, action));
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

        case 'fade_off': {
          if (Device instanceof Light || Device instanceof Bulb) {
            (async () => {
              const currentBrightness = await Device.getBrightness();
              for (let i = currentBrightness - constants.fadeIncrement; i > 0; i -= constants.fadeIncrement) {
                await Device.setBrightness(i);
                await delay(constants.fadeDelay);
              }
              return Device.turnOff();
            })().then((response) => actionCallback(response, action));
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

        case 'fade_on': {
          if (Device instanceof Light || Device instanceof Bulb) {
            (async () => {
              const currentBrightness = await Device.getBrightness();
              for (let i = constants.fadeIncrement; i < currentBrightness; i += constants.fadeIncrement) {
                await Device.setBrightness(i);
                await delay(constants.fadeDelay);
              }
              return Device.setBrightness(currentBrightness);
            })().then((response) => actionCallback(response, action));
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

        case 'fade_brightness':
          // falls through
        case 'fade_luminance': {
          if (Device instanceof Light || Device instanceof Bulb) {
            (async () => {
              const currentBrightness = await Device.getBrightness();
              if (value < currentBrightness) {
                for (let i = currentBrightness - constants.fadeIncrement; i > value; i -= constants.fadeIncrement) {
                  await Device.setBrightness(i);
                  await delay(constants.fadeDelay);
                }
              } else {
                for (let i = currentBrightness + constants.fadeIncrement; i < value; i += constants.fadeIncrement) {
                  await Device.setBrightness(i);
                  await delay(constants.fadeDelay);
                }
              }
              return Device.setBrightness(value);
            })().then((response) => actionCallback(response, action));
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

        case 'fade_color': {
          if (Device instanceof Light || Device instanceof Bulb) {
            (async () => {
              const currentColor = await Device.getColor();
              const targetColor = await dataFn.findOne('Color', { name: fn.slugify(value.color)?.value || value });
              const intermediateColors = [];
              for (let i = constants.fadeIncrement; i < 100; i += constants.fadeIncrement) {
                const intermediateColor = blendColors(i / 100, [currentColor, targetColor]);
                intermediateColors.push(intermediateColor);
              }
              for (let i = 0; i < intermediateColors.length; i++) {
                const intermediateColor = intermediateColors[i];
                await Device.setColor(intermediateColor);
                await delay(constants.fadeDelay);
              }
              return Device.setColor(targetColor);
            })().then((response) => actionCallback(response, action));
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

        case 'fade_temperature': {
          if (Device instanceof Light || Device instanceof Bulb) {
            (async () => {
              const currentTemperature = await Device.getColorTemperature();
              if (value < currentTemperature) {
                for (let i = currentTemperature - constants.fadeIncrement; i > value; i -= constants.fadeIncrement) {
                  await Device.setColorTemperature(i);
                  await delay(constants.fadeDelay);
                }
              } else {
                for (let i = currentTemperature + constants.fadeIncrement; i < value; i += constants.fadeIncrement) {
                  await Device.setColorTemperature(i);
                  await delay(constants.fadeDelay);
                }
              }
              return Device.setColorTemperature(value);
            })().then((response) => actionCallback(response, action));
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

    const deviceNames = _.uniq(deviceActions.filter((deviceAction) => !deviceAction.nickname.match(/^\*/))
      .map((deviceAction) => fn.slugify(deviceAction.nickname)));
    const deviceTypes = _.uniq(deviceActions.filter((deviceAction) => deviceAction.nickname.match(/^\*/))
      .map((deviceAction) => {
        const deviceType = deviceAction.nickname.match(/^\*(.*)/)[1].toLowerCase();
        return deviceType || '*';
      }));

    const {
      devicesByNickname,
      devicesByGroupId,
      devicesByRoomId,
    } = await exports.getDevicesByModels(deviceNames, deviceTypes);
    const devices = Object.values(devicesByNickname).flatMap((devices) => devices);
    const deviceIds = _.uniq(devices.map((device) => device.id));
    const deviceIdsByRoomId = Object.fromEntries(
      Object.entries(devicesByRoomId)
        .map(([roomId, devices]) => [roomId, _.uniq(devices.map((device) => device.id))]),
    );
    const deviceIdsByGroupId = Object.fromEntries(
      Object.entries(devicesByGroupId)
        .map(([groupId, devices]) => [groupId, _.uniq(devices.map((device) => device.id))]),
    );
    const roomIds = Object.keys(deviceIdsByRoomId);
    const groupIds = Object.keys(deviceIdsByGroupId);
    const shortPresetActionsByDeviceId = await exports.getShortPresetActionsByDeviceId({
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

    const deviceActionsLoopCallback = async (deviceAction) => {
      const deviceActionCopy = _.cloneDeep(deviceAction);
      const deviceNickname = deviceActionCopy.nickname;

      if (!deviceNickname) {
        logger.warn('Skipping empty nickname');
        return;
      }

      const deviceType = deviceNickname.substring(0, 1) === '*' ? deviceNickname.replace(/^\*(.+)/, '$1') : null;

      const matchingDevices = deviceType === null
        ? devicesByNickname[fn.slugify(deviceNickname)] || []
        : devices.filter((device) => deviceType === '*' || device.type === deviceType);

      if (matchingDevices.length === 0) {
        errors.push({
          success: false,
          status: 404,
          error: 'DEVICE_NOT_FOUND',
          message: `Cannot find device ${deviceNickname}`,
        });

        return;
      }

      totalDevices += matchingDevices.length;

      await Promise.all(matchingDevices.map((device) => (async (device) => {
        const deviceInfo = Devices[device.mfg_id];
        if (!deviceInfo) {
          errors.push({
            success: false,
            status: 404,
            error: 'DEVICE_NOT_FOUND',
            message: `Cannot find device ${deviceNickname}`,
          });

          deviceCounter += 1;
          return;
        }
        const { Device, deviceDef } = deviceInfo;
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
          presets: shortPresetActionsByDeviceId[device.id],
          info: device,
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
          conditionalActions: conditionalActionsByDeviceId[device.id],
          deviceAction: deviceActionCopy,
          deviceData,
        });

        Device.override = deviceActionCopy.time !== false;

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
      })(device)));
    };

    await deviceActions.forEach(deviceActionsLoopCallback);

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
          console.error(errors);
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

  await transaction.commit();
};

exports.getDevicesByModels = async (deviceNames, deviceTypes) => {
  const devicesByNickname = {};

  if (!deviceNames?.length && deviceTypes?.length === 1 && deviceTypes[0] === '*') {
    devicesByNickname['*'] = await dataFn.findAll('Device');
  }

  const aliases = await dataFn.findAll('Alias', { alias: deviceNames });
  const roomAliases = aliases?.filter((alias) => alias.model === 'room') || [];
  const groupAliases = aliases?.filter((alias) => alias.model === 'group') || [];
  const deviceAliases = aliases?.filter((alias) => alias.model === 'device') || [];

  const groups = await dataFn.findAll('Group', [{
    id: groupAliases.map((alias) => alias.model_id),
  }, {
    name: deviceNames,
  }]);

  let allGroups = [];
  const groupRooms = [];
  const groupDevices = [];
  const groupGroups = [];

  if (groups?.length > 0) {
    allGroups = await groupHelper.flattenGroups(groups);
    // eslint-disable-next-line camelcase
    const groupModels = await dataFn.findAll('GroupModel', { group_id: allGroups.map((group) => group.id) });

    if (groupModels?.length > 0) {
      groupRooms.push(...groupModels.filter((groupModel) => groupModel.model === 'room'));
      groupDevices.push(...groupModels.filter((groupModel) => groupModel.model === 'device'));
      groupGroups.push(...groupModels.filter((groupModel) => groupModel.model === 'group'));
    }
  }

  const rooms = await dataFn.findAll('Room', [{
    id: [
      ...roomAliases?.map((alias) => alias.model_id) || [],
      ...groupRooms?.map((groupRoom) => groupRoom.model_id) || [],
    ],
  }, {
    name: deviceNames,
  }]);

  const devices = await dataFn.findAll('Device', [{
    id: [
      ...groupDevices?.map((groupDevice) => groupDevice.model_id) || [],
      ...deviceAliases?.map((alias) => alias.model_id) || [],
    ],
  }, {
    room_id: rooms?.map((room) => room.id) || [],
    type: 'bulb',
  }, {
    mfg_id: deviceNames,
  }, {
    name: deviceNames,
  }, {
    type: deviceTypes,
  }]);

  const groupModelsForDevice = await dataFn.findAll('GroupModel', {
    model: 'device',
    model_id: devices.map((device) => device.id),
  });

  if (groupModelsForDevice.length > 0) {
    const groupsForDevice = await dataFn.findAll('Group', {
      id: groupModelsForDevice.map((groupModel) => groupModel.group_id),
    });

    allGroups.push(...groupsForDevice);
  }

  const devicesById = _.keyBy(devices, 'id');
  const devicesByRoomId = _.groupBy(devices, 'room_id');
  const devicesByGroupId = {};
  const allGroupsById = _.keyBy(allGroups, 'id');
  const groupDevicesByGroupId = _.groupBy(groupDevices, 'group_id');
  const groupRoomsByGroupId = _.groupBy(groupRooms, 'group_id');
  const groupGroupsByModelId = _.groupBy(groupGroups, 'model_id');

  devices?.forEach((device) => {
    devicesByNickname[device.name] = [device];
  });

  rooms?.forEach((room) => {
    const devices = devicesByRoomId[room.id];
    if (devices?.length > 0) {
      devicesByNickname[room.name] = _.uniqBy([
        ...devicesByNickname[room.name] || [],
        ...devices,
      ], 'mfg_id');
    }
  });

  allGroups?.forEach((group) => {
    const devices = groupDevicesByGroupId[group.id]
      ?.map((groupDevice) => devicesById[groupDevice.model_id])
      ?.filter((device) => device) || [];
    let parentGroup = allGroupsById[groupGroupsByModelId[group.id]?.group_id];
    while (parentGroup) {
      devicesByNickname[parentGroup.name] = _.uniqBy([
        ...devicesByNickname[parentGroup.name] || [],
        ...devices || [],
      ], 'mfg_id');

      devicesByGroupId[parentGroup.id] = _.uniqBy([
        ...devicesByGroupId[parentGroup.id] || [],
        ...devices || [],
      ], 'mfg_id');

      parentGroup = allGroupsById[groupGroupsByModelId[parentGroup.id]?.group_id];
    }

    if (devices?.length > 0) {
      devicesByNickname[group.name] = _.uniqBy([
        ...devicesByNickname[group.name] || [],
        ...devices,
      ], 'mfg_id');

      devicesByGroupId[group.id] = _.uniqBy([
        ...devicesByGroupId[group.id] || [],
        ...devices,
      ], 'mfg_id');
    }

    const groupRooms = groupRoomsByGroupId[group.id];
    groupRooms?.forEach((groupRoom) => {
      const devices = devicesByRoomId[groupRoom.model_id];
      if (devices?.length > 0) {
        devicesByNickname[group.name] = _.uniqBy([
          ...devicesByNickname[group.name] || [],
          ...devices,
        ], 'mfg_id');
      }
    });
  });

  deviceAliases?.forEach((deviceAlias) => {
    const device = devicesById[deviceAlias.model_id];
    if (device) {
      devicesByNickname[deviceAlias.alias] = _.uniqBy([
        ...devicesByNickname[deviceAlias.alias] || [],
        device,
      ], 'mfg_id');
    }
  });

  roomAliases?.forEach((roomAlias) => {
    const devices = devicesByRoomId[roomAlias.model_id];
    if (devices?.length > 0) {
      devicesByNickname[roomAlias.alias] = _.uniqBy([
        ...devicesByNickname[roomAlias.alias] || [],
        ...devices,
      ], 'mfg_id');
    }
  });

  groupAliases?.forEach((groupAlias) => {
    const devices = devicesByGroupId[groupAlias.model_id];
    if (devices?.length > 0) {
      devicesByNickname[groupAlias.alias] = _.uniqBy([
        ...devicesByNickname[groupAlias.alias] || [],
        ...devices,
      ], 'mfg_id');
    }
  });

  return {
    devicesByNickname,
    devicesById,
    devicesByRoomId,
    devicesByGroupId,
    groupsById: allGroupsById,
    groupDevicesByGroupId,
    groupRoomsByGroupId,
    groupGroupsByModelId,
  };
};

const constants = require('./constants');
const groupHelper = require('./groupHelper');

const {
  _,
  Bulb,
  Climate,
  dataFn,
  delay,
  Devices,
  Dimmer,
  fn,
  Light,
  logger,
  MerossDimmer,
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

exports.getDeviceStates = async (deviceNames) => {
  if (!Array.isArray(deviceNames) || deviceNames.length === 0) {
    return [];
  }

  const deviceNamesOnly = _.uniq(deviceNames.filter((deviceName) => !deviceName.match(/^\*/))
    .map((deviceName) => fn.slugify(deviceName)));
  const deviceTypesOnly = _.uniq(deviceNames.filter((deviceName) => deviceName.match(/^\*/))
    .map((deviceName) => {
      const deviceType = deviceName.match(/^\*(.*)/)[1].toLowerCase();
      return deviceType || '*';
    }));

  const { devicesByNickname } = await exports.getDevicesByModels(deviceNamesOnly, deviceTypesOnly);
  const devices = _.uniqBy(Object.values(devicesByNickname).flatMap((devices) => devices), 'mfgId');

  const deviceStates = devices.map((device) => {
    if (!Devices[device.mfgId]) {
      return null;
    }
    const { Device } = Devices[device.mfgId];
    return {
      id: device.id,
      name: Device.name,
      online: Device.online,
      state: Device.state,
      ...(Device.lightValues
        ? {
          lightState: {
            brightness: 0,
            colorTemp: 0,
            color: '#ffffff',
            ...Device.lightValues,
          },
        }
        : {
          lightState: {
            brightness: 0,
            colorTemp: 0,
            color: '#ffffff',
          },
        }),
    };
  }).filter((deviceResponse) => deviceResponse) || [];

  return deviceStates.filter((device) => device);
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
    ...(numericDeviceIds?.length ? [{
      model: 'device',
      modelId: numericDeviceIds,
    }] : [{}]),
    ...(numericRoomIds?.length ? [{
      model: 'room',
      modelId: numericRoomIds,
    }] : [{}]),
    ...(numericGroupIds?.length ? [{
      model: 'group',
      modelId: numericGroupIds,
    }] : [{}]),
  ]);

  const allPresetActions = await dataFn.findAll('PresetAction', { presetId: allPresets.map((preset) => preset.id) });

  const presetShortActionsByPresetId = Object.fromEntries(
    Object.entries(_.groupBy(allPresetActions, 'presetId')).map(([presetId, presetActions]) => [
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

  const presetsByDeviceId = _.groupBy(allPresets.filter((preset) => preset.model === 'device'), 'modelId');
  const presetsByRoomId = _.groupBy(allPresets.filter((preset) => preset.model === 'room'), 'modelId');
  const presetsByGroupId = _.groupBy(allPresets.filter((preset) => preset.model === 'group'), 'modelId');

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
    ...(numericDeviceIds?.length ? [{
      model: 'device',
      modelId: numericDeviceIds,
    }] : [{}]),
    ...(numericRoomIds?.length ? [{
      model: 'room',
      modelId: numericRoomIds,
    }] : [{}]),
    ...(numericGroupIds?.length ? [{
      model: 'group',
      modelId: numericGroupIds,
    }] : [{}]),
  ]);

  const presets = await dataFn.findAll('Preset', { id: conditionalActions.map((conditionalAction) => conditionalAction.presetId) });

  const presetsById = _.keyBy(presets, 'id');

  const conditionalActionsByDeviceId = _.groupBy(
    conditionalActions.filter((conditionalAction) => conditionalAction.model === 'device'),
    'modelId',
  );

  const conditionalActionsByRoomId = _.groupBy(
    conditionalActions.filter((conditionalAction) => conditionalAction.model === 'room'),
    'modelId',
  );

  const conditionalActionsByGroupId = _.groupBy(
    conditionalActions.filter((conditionalAction) => conditionalAction.model === 'group'),
    'modelId',
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
    Object.fromEntries(Object.entries(_.groupBy(conditionalActions, 'conditionType')).map(([conditionType, conditionalActions]) => ([
      conditionType,
      Object.fromEntries(Object.entries(_.groupBy(conditionalActions, 'action')).map(([actionName, conditionalActions]) => ([
        actionName,
        Object.fromEntries(conditionalActions.map((conditionalAction) => ([
          conditionalAction.condition ?? 'default',
          presetsById[conditionalAction.presetId]?.name,
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

  return parseInt(mutableLightValue, 10);
};

exports.combineLightValueActions = (actions, Device) => {
  const newActions = _.cloneDeep(actions);
  const colorValue = newActions.color;
  const brightnessValue = exports.calculateNewLightValue(newActions.brightness || newActions.luminance, 'brightness', newActions, Device);
  const temperatureValue = exports.calculateNewLightValue(newActions.temperature, 'colorTemp', newActions, Device);
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

exports.getDevices = async () => [
  ...(await exports.getTuyaDevices() || []), ...(await exports.getMerossDevices() || []),
];

exports.getMerossDevices = async () => Object.values(Devices).map(({ deviceDef }) => ({
  nickname: deviceDef.name,
  data: {
    online: true,
    state: true,
    lightState: {},
  },
  name: deviceDef.name,
  icon: null,
  id: deviceDef.mfgId,
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
          if ((conditionalActions.time[actionSlug]
            || (['toggle', 'on_if_off'].includes(actionSlug) && conditionalActions.time.on)
            || (['toggle', 'off_if_on'].includes(actionSlug) && conditionalActions.time.off))) {
            let timeAction = actionSlug;
            if (['toggle', 'on_if_off'].includes(actionSlug)) {
              const isOn = await deviceData.Device.isOn();
              if (!isOn) {
                timeAction = 'on';
              }
            } else if (['toggle', 'off_if_on'].includes(actionSlug)) {
              const isOn = await deviceData.Device.isOn();
              if (isOn) {
                timeAction = 'off';
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

        case 'off_if_on': {
          Device.isOn().then((isOn) => {
            if (isOn) {
              Device.turnOff().then((response) => actionCallback(response, action));
            }
          });
          break;
        }

        case 'on':
        case 'on_preserve': {
          Device.turnOn().then((response) => actionCallback(response, action));
          break;
        }

        case 'on_if_off': {
          Device.isOn().then((isOn) => {
            if (!isOn) {
              Device.turnOn().then((response) => actionCallback(response, action));
            }
          });
          break;
        }

        case 'toggle':
        case 'toggle_preserve': {
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
          if (Device instanceof Light || Device instanceof Bulb || Device instanceof MerossDimmer) {
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

        case 'dimmer': {
          if (Device instanceof Dimmer) {
            Device.setDimmerLevel(value).then((response) => actionCallback(response, action));
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
          const color = await dataFn.findOne('Color', { name: fn.slugify(value) });
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
              const targetColor = await dataFn.findOne('Color', { name: fn.slugify(value) });
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

exports.performDeviceActions = async (actions) => {
  try {
    const errors = [];
    const successes = [];

    let totalDevices = 0;
    let deviceCounter = 0;

    const actionsByModel = _.groupBy(actions, 'model');

    const devicesByModelId = {};

    const deviceModelActions = actionsByModel.device;
    if (deviceModelActions) {
      const deviceActionsByDeviceType = _.groupBy(deviceModelActions, (deviceAction) => deviceAction.type || '*');
      const deviceIdsByDeviceType = Object.entries(deviceActionsByDeviceType).map(([deviceType, deviceActions]) => {
        const deviceIds = deviceActions.flatMap(({ id, ids }) => [...(ids || []), ...(id ? [id] : [])]);
        return {
          ...(deviceIds?.length && !(deviceIds.length === 1 && deviceIds[0] === '*') ? { id: deviceIds } : {}),
          ...(deviceType !== '*' ? { type: deviceType } : {}),
        };
      });

      devicesByModelId.device = await exports.getDevicesByIdAndType(deviceIdsByDeviceType);
    }

    const roomActions = actionsByModel.room;
    if (roomActions) {
      const roomActionsByDeviceType = _.groupBy(roomActions, (roomAction) => roomAction.type || '*');
      const roomIdsByDeviceType = Object.entries(roomActionsByDeviceType).map(([deviceType, roomActions]) => {
        const roomIds = roomActions.flatMap(({ id, ids }) => [...(ids || []), ...(id ? [id] : [])]);
        return {
          ...(roomIds?.length && !(roomIds.length === 1 && roomIds[0] === '*') ? { roomId: roomIds } : {}),
          ...(deviceType !== '*' ? { type: deviceType } : {}),
        };
      });

      devicesByModelId.room = await exports.getDevicesByRoomAndType(roomIdsByDeviceType);
    }

    const groupActions = actionsByModel.group;
    if (groupActions) {
      const groupIds = groupActions.flatMap(({ id, ids }) => [...(ids || []), ...(id ? [id] : [])]);
      devicesByModelId.group = await exports.getDevicesByGroup(groupIds);
    }

    const deviceActions = actions.flatMap(({
      model, id, ids, type, actions,
    }) => {
      const modelIds = [...(ids || []), ...(id ? [id] : [])];
      let devices;
      if (modelIds.includes('*')) {
        devices = _.uniqBy(Object.values(devicesByModelId[model]).flatMap((devices) => devices), 'id');
      } else {
        devices = modelIds.flatMap((modelId) => devicesByModelId[model]?.[modelId]);
      }
      return devices.filter((device) => !type || type === '*' || type === device.type)
        .map((device) => ({
          device,
          actions,
        }));
    });

    const devices = Object.values(devicesByModelId.device || {});
    const deviceIds = devices.map((device) => device.id);
    const deviceIdsByRoomId = Object.fromEntries(Object.entries(fn.merge(
      (devicesByModelId.room || {}),
      _.groupBy(devices, 'roomId'),
    ))
      .map(([roomId, devices]) => [roomId, _.uniq(devices.map((device) => device.id))]));
    const roomIds = Object.keys(deviceIdsByRoomId).map((roomId) => Number.parseInt(roomId, 10));
    const deviceIdsByGroupId = Object.fromEntries(Object.entries(fn.merge(
      (devicesByModelId.group || {}),
      (await exports.getGroupsForDevices(deviceIds)),
      (await exports.getGroupsForDevicesFromRoomIds(roomIds)),
    ))
      .map(([groupId, devices]) => [groupId, _.uniq(devices.map((device) => device.id))]));
    const groupIds = Object.keys(deviceIdsByGroupId).map((groupId) => Number.parseInt(groupId, 10));
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
      const device = deviceActionCopy?.device;

      if (!device) {
        logger.warn('Skipping empty device id');
        return;
      }

      totalDevices += 1;

      const deviceInfo = Devices[device.mfgId];
      if (!deviceInfo) {
        errors.push({
          success: false,
          status: 404,
          error: 'DEVICE_NOT_FOUND',
          message: `Cannot find device id: ${device.id}, mfgId: ${device.mfgId}`,
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
        ...device,
        presets: shortPresetActionsByDeviceId[device.id],
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

exports.performDeviceActionsByNickname = async (deviceActions) => {
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
        const deviceInfo = Devices[device.mfgId];
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
      roomId,
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

exports.getDevicesByIdAndType = async (deviceIdsByDeviceType) => _.keyBy(await dataFn.findAll('Device', deviceIdsByDeviceType), 'id');

exports.getDevicesByRoomAndType = async (roomIdsByDeviceType) => _.groupBy(await dataFn.findAll('Device', roomIdsByDeviceType), 'roomId');

exports.getDevicesByGroup = async (groupIds) => {
  let originalGroups;
  if (groupIds.includes('*')) {
    originalGroups = await dataFn.findAll('Group');
  } else {
    originalGroups = groupIds.map((groupId) => ({ id: groupId }));
  }

  const allGroups = await groupHelper.flattenGroups(originalGroups);
  const groupModels = await dataFn.findAll('GroupModel', { groupId: allGroups.map((group) => group.id) });
  const groupModelsByModel = _.groupBy(groupModels, 'model');

  const groupIdsByDevice = Object.fromEntries(groupModelsByModel.device?.map(({
    groupId,
    modelId,
  }) => [modelId, groupId]) || []);
  const groupIdsByRoom = Object.fromEntries(groupModelsByModel.room?.map(({
    groupId,
    modelId,
  }) => [modelId, groupId]) || []);
  const groupIdsBySubGroup = Object.fromEntries(groupModelsByModel.group?.map(({
    groupId,
    modelId,
  }) => [modelId, groupId]) || []);

  const devices = await dataFn.findAll('Device', [
    ...(groupModelsByModel.device?.length ? [{
      id: groupModelsByModel.device.map(({
        modelId,
      }) => modelId),
    }] : [{}]),
    ...(groupModelsByModel.room?.length ? [{
      roomId: groupModelsByModel.room.map(({
        modelId,
      }) => modelId),
    }] : [{}]),
  ]);

  const devicesByGroup = {};

  devices.forEach((device) => {
    let subGroupId;

    const deviceGroupId = groupIdsByDevice[device.id];
    if (deviceGroupId) {
      devicesByGroup[deviceGroupId] = [...(devicesByGroup[deviceGroupId] || []), device];
      subGroupId = deviceGroupId;
      while (groupIdsBySubGroup[subGroupId]) {
        devicesByGroup[subGroupId] = _.uniqBy([...(devicesByGroup[subGroupId] || []), device], 'id');
        subGroupId = groupIdsBySubGroup[subGroupId];
      }
    }

    const roomGroupId = groupIdsByRoom[device.roomId];
    if (roomGroupId) {
      devicesByGroup[roomGroupId] = [...(devicesByGroup[roomGroupId] || []), device];
      subGroupId = roomGroupId;
      while (groupIdsBySubGroup[subGroupId]) {
        devicesByGroup[subGroupId] = _.uniqBy([...(devicesByGroup[subGroupId] || []), device], 'id');
        subGroupId = groupIdsBySubGroup[subGroupId];
      }
    }
  });

  return devicesByGroup;
};

exports.getGroupsForDevices = async (deviceIds) => {
  const devicesById = _.keyBy(await dataFn.findAll('Device', { id: deviceIds }), 'id');
  return Object.fromEntries(
    Object.entries(
      _.groupBy(await dataFn.findAll('GroupModel', { model: 'device', modelId: deviceIds }), 'groupId'),
    ).map(([groupId, groupModels]) => [groupId, groupModels.map(({ modelId }) => devicesById[modelId])]),
  );
};

exports.getGroupsForDevicesFromRoomIds = async (roomIds) => {
  const devicesByRoom = await exports.getDevicesByRoomAndType(roomIds.map((roomId) => ({ roomId })));
  const deviceIds = Object.values(devicesByRoom).flatMap((devices) => devices.map((device) => device.id));
  const devicesByGroupId = await exports.getGroupsForDevices(deviceIds);
  const entriesOfRoomIdsByGroup = Object.entries(
    _.groupBy(await dataFn.findAll('GroupModel', { model: 'room', modelId: roomIds }), 'groupId'),
  ).map(([groupId, groupModels]) => [groupId, groupModels.map(({ modelId }) => modelId)]);
  const devicesFromRoomIdsByGroupId = Object.fromEntries(
    entriesOfRoomIdsByGroup.map(([groupId, roomIds]) => (
      [groupId, roomIds.map((roomId) => devicesByRoom[roomId])]
    )),
  );
  return fn.merge(devicesByGroupId, devicesFromRoomIdsByGroupId);
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
    id: groupAliases.map((alias) => alias.modelId),
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
    const groupModels = await dataFn.findAll('GroupModel', { groupId: allGroups.map((group) => group.id) });

    if (groupModels?.length > 0) {
      groupRooms.push(...groupModels.filter((groupModel) => groupModel.model === 'room'));
      groupDevices.push(...groupModels.filter((groupModel) => groupModel.model === 'device'));
      groupGroups.push(...groupModels.filter((groupModel) => groupModel.model === 'group'));
    }
  }

  const rooms = await dataFn.findAll('Room', [{
    id: [
      ...roomAliases?.map((alias) => alias.modelId) || [],
      ...groupRooms?.map((groupRoom) => groupRoom.modelId) || [],
    ],
  }, {
    name: deviceNames,
  }]);

  const devices = await dataFn.findAll('Device', [{
    id: [
      ...groupDevices?.map((groupDevice) => groupDevice.modelId) || [],
      ...deviceAliases?.map((alias) => alias.modelId) || [],
    ],
  }, {
    roomId: rooms?.map((room) => room.id) || [],
    type: 'bulb',
  }, {
    mfgId: deviceNames,
  }, {
    name: deviceNames,
  }, {
    type: deviceTypes,
  }]);

  const groupModelsForDevice = await dataFn.findAll('GroupModel', {
    model: 'device',
    modelId: devices.map((device) => device.id),
  });

  if (groupModelsForDevice.length > 0) {
    const groupsForDevice = await dataFn.findAll('Group', {
      id: groupModelsForDevice.map((groupModel) => groupModel.groupId),
    });

    allGroups.push(...groupsForDevice);
  }

  const devicesById = _.keyBy(devices, 'id');
  const devicesByRoomId = _.groupBy(devices, 'roomId');
  const devicesByGroupId = {};
  const allGroupsById = _.keyBy(allGroups, 'id');
  const groupDevicesByGroupId = _.groupBy(groupDevices, 'groupId');
  const groupRoomsByGroupId = _.groupBy(groupRooms, 'groupId');
  const groupGroupsByModelId = _.groupBy(groupGroups, 'modelId');

  devices?.forEach((device) => {
    devicesByNickname[device.name] = [device];
  });

  rooms?.forEach((room) => {
    const devices = devicesByRoomId[room.id];
    if (devices?.length > 0) {
      devicesByNickname[room.name] = _.uniqBy([
        ...devicesByNickname[room.name] || [],
        ...devices,
      ], 'mfgId');
    }
  });

  allGroups?.forEach((group) => {
    const devices = groupDevicesByGroupId[group.id]
      ?.map((groupDevice) => devicesById[groupDevice.modelId])
      ?.filter((device) => device) || [];
    let parentGroup = allGroupsById[groupGroupsByModelId[group.id]?.groupId];
    while (parentGroup) {
      devicesByNickname[parentGroup.name] = _.uniqBy([
        ...devicesByNickname[parentGroup.name] || [],
        ...devices || [],
      ], 'mfgId');

      devicesByGroupId[parentGroup.id] = _.uniqBy([
        ...devicesByGroupId[parentGroup.id] || [],
        ...devices || [],
      ], 'mfgId');

      parentGroup = allGroupsById[groupGroupsByModelId[parentGroup.id]?.groupId];
    }

    if (devices?.length > 0) {
      devicesByNickname[group.name] = _.uniqBy([
        ...devicesByNickname[group.name] || [],
        ...devices,
      ], 'mfgId');

      devicesByGroupId[group.id] = _.uniqBy([
        ...devicesByGroupId[group.id] || [],
        ...devices,
      ], 'mfgId');
    }

    const groupRooms = groupRoomsByGroupId[group.id];
    groupRooms?.forEach((groupRoom) => {
      const devices = devicesByRoomId[groupRoom.modelId];
      if (devices?.length > 0) {
        devicesByNickname[group.name] = _.uniqBy([
          ...devicesByNickname[group.name] || [],
          ...devices,
        ], 'mfgId');
      }
    });
  });

  deviceAliases?.forEach((deviceAlias) => {
    const device = devicesById[deviceAlias.modelId];
    if (device) {
      devicesByNickname[deviceAlias.alias] = _.uniqBy([
        ...devicesByNickname[deviceAlias.alias] || [],
        device,
      ], 'mfgId');
    }
  });

  roomAliases?.forEach((roomAlias) => {
    const devices = devicesByRoomId[roomAlias.modelId];
    if (devices?.length > 0) {
      devicesByNickname[roomAlias.alias] = _.uniqBy([
        ...devicesByNickname[roomAlias.alias] || [],
        ...devices,
      ], 'mfgId');
    }
  });

  groupAliases?.forEach((groupAlias) => {
    const devices = devicesByGroupId[groupAlias.modelId];
    if (devices?.length > 0) {
      devicesByNickname[groupAlias.alias] = _.uniqBy([
        ...devicesByNickname[groupAlias.alias] || [],
        ...devices,
      ], 'mfgId');
    }
  });

  groupModelsForDevice?.forEach((groupModel) => {
    devicesByGroupId[groupModel.groupId] = _.uniqBy([
      ...devicesByGroupId[groupModel.groupId] || [],
      ...[devicesById[groupModel.modelId]],
    ].filter((device) => device), 'mfgId');
  });

  groupRooms?.forEach((groupModel) => {
    devicesByGroupId[groupModel.groupId] = _.uniqBy([
      ...devicesByGroupId[groupModel.groupId] || [],
      ...[devicesByRoomId[groupModel.modelId]],
    ].filter((device) => device), 'mfgId');
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

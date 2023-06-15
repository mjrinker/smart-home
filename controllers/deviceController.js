const deviceHelper = require('../helpers/deviceHelper');

const {
  _,
  Devices,
  fn,
} = global;

exports.performActions = fn.asyncMw(async (req, res) => {
  const deviceActions = req.body;
  const response = await deviceHelper.performDeviceActions(deviceActions);
  return fn.sendResponse(req, res, response.status, response);
});

exports.getDeviceState = fn.asyncMw(async (req, res) => {
  const deviceNames = req.body || [];
  if (!Array.isArray(deviceNames) || deviceNames.length === 0) {
    return fn.sendResponse(req, res, 400, {
      success: false,
      status: 400,
      error: 'NO_DEVICE_NAMES',
      message: 'Request body must be an array of device names',
    });
  }

  const deviceNamesOnly = _.uniq(deviceNames.filter((deviceName) => !deviceName.match(/^\*/))
    .map((deviceName) => fn.slugify(deviceName)));
  const deviceTypesOnly = _.uniq(deviceNames.filter((deviceName) => deviceName.match(/^\*/))
    .map((deviceName) => {
      const deviceType = deviceName.match(/^\*(.*)/)[1].toLowerCase();
      return deviceType || '*';
    }));

  const { devicesByNickname } = await deviceHelper.getDevicesByModels(deviceNamesOnly, deviceTypesOnly);
  const devices = _.uniqBy(Object.values(devicesByNickname).flatMap((devices) => devices), 'mfg_id');

  const deviceStates = devices.map((device) => {
    if (!Devices[device.mfg_id]) {
      return null;
    }
    const { Device } = Devices[device.mfg_id];
    return {
      name: Device.name,
      online: Device.online,
      state: Device.state,
      ...(Device.lightValues
        ? {
          light_state: {
            brightness: 0,
            color_temp: 0,
            color: '#ffffff',
            ...Device.lightValues,
          },
        }
        : {
          light_state: {
            brightness: 0,
            color_temp: 0,
            color: '#ffffff',
          },
        }),
    };
  }).filter((deviceResponse) => deviceResponse) || [];

  return fn.sendResponse(req, res, 200, {
    success: true,
    status: 200,
    code: 0,
    devices: deviceStates.filter((device) => device),
  });
});

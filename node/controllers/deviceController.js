const envVars = module.parent.exports;
const deviceHelper = require('../helpers/deviceHelper');

const {
  _,
  fn,
} = envVars;

exports.performActions = fn.asyncMw(async (req, res) => {
  const deviceActions = req.body;
  const response = await deviceHelper.performDeviceActions(deviceActions);
  return res.status(response.status).json(response);
});

exports.getDeviceState = fn.asyncMw(async (req, res) => {
  const deviceNames = req.body || [];
  if (!Array.isArray(deviceNames) || deviceNames.length === 0) {
    return res.status(400).json({
      success: false,
      status: 400,
      error: 'NO_DEVICE_NAMES',
      message: 'Request body must be an array of device names',
    });
  }

  const mfgIds = (await Promise.all(deviceNames.flatMap((deviceName) => (async (deviceName) => {
    const deviceInfo = global.deviceConfig[fn.slugify(deviceName)] || {};

    if (deviceName.match(/^\*/)) {
      const deviceType = deviceName.match(/^\*(.*)/)[1].toLowerCase();
      return fn.filterMap(Object.values(global.deviceConfig),
        (device) => (
          _.isPlainObject(device) && (!deviceType || device.type === deviceType)
        ),
        (device) => device.mfg_id);
    }

    let deviceIdsInfo = [];
    try {
      deviceIdsInfo = deviceHelper.getDeviceIdInfo(deviceInfo, deviceName);
      deviceIdsInfo = _.uniqBy(deviceIdsInfo, (deviceIdInfo) => `${deviceIdInfo.platform} - ${deviceIdInfo.id}`);
    } catch (error) {
      if (error.name === 'CIRCULAR_ALIAS') {
        return null;
      }
    }

    if (!deviceIdsInfo || deviceIdsInfo.length === 0) {
      return null;
    }

    return Promise.all(deviceIdsInfo.map((deviceIdInfo) => (async (deviceIdInfo) => {
      if (deviceIdInfo.platform === 'meross') {
        return deviceIdInfo.mfg_id;
      }

      return null;
    })(deviceIdInfo)));
  })(deviceName)))).filter((deviceResponse) => deviceResponse)[0] || [];

  const devices = await Promise.all(mfgIds.map((mfgId) => (async (mfgId) => {
    if (!global.Devices[mfgId]) {
      return null;
    }
    const { deviceDef, Device } = global.Devices[mfgId];
    return {
      name: deviceDef.devName,
      online: Device.online,
      state: Device.state,
      ...(Device.lightValues ? { light_state: Device.lightValues } : {}),
    };
  })(mfgId)));

  return res.status(200).json({
    success: true,
    status: 200,
    code: 0,
    devices: devices.filter((device) => device),
  });
});

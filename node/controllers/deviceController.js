const envVars = module.parent.exports;
const deviceHelper = require('../helpers/deviceHelper');

const {
  _,
  fn,
} = envVars;

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

  const devices = deviceNames.flatMap((deviceName) => {
    const deviceInfo = global.deviceConfig[fn.slugify(deviceName)] || {};

    let deviceIdsInfo = [];
    if (deviceName.match(/^\*/)) {
      const deviceType = deviceName.match(/^\*(.*)/)[1].toLowerCase();
      deviceIdsInfo = Object.values(global.deviceConfig).filter((device) => (
        _.isPlainObject(device) && (!deviceType || device.type === deviceType)
      ));
    } else {
      try {
        deviceIdsInfo = deviceHelper.getDeviceIdInfo(deviceInfo, deviceName);
        deviceIdsInfo = _.uniqBy(deviceIdsInfo, (deviceIdInfo) => `${deviceIdInfo.platform} - ${deviceIdInfo.id}`);
      } catch (error) {
        if (error.name === 'CIRCULAR_ALIAS') {
          return null;
        }
      }
    }

    if (!deviceIdsInfo || deviceIdsInfo.length === 0) {
      return null;
    }

    return deviceIdsInfo.map((deviceIdInfo) => {
      if (!global.Devices[deviceIdInfo.mfg_id]) {
        return null;
      }
      const { Device } = global.Devices[deviceIdInfo.mfg_id];
      return {
        name: Device.name,
        online: Device.online,
        state: Device.state,
        ...(Device.lightValues ? { light_state: Device.lightValues } : {}),
      };
    });
  }).filter((deviceResponse) => deviceResponse) || [];

  return fn.sendResponse(req, res, 200, {
    success: true,
    status: 200,
    code: 0,
    devices: devices.filter((device) => device),
  });
});

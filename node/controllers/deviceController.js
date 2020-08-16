const envVars = module.parent.exports;
const deviceHelper = require('../helpers/deviceHelper');

const {
  deviceConfig,
  fetch,
  fn,
  merossFullURL,
} = envVars;

exports.performActions = fn.asyncMw(async (req, res) => {
  const deviceActions = req.body;
  const response = await deviceHelper.performDeviceActions(deviceActions);
  return res.status(response.status).json(response);
});

exports.getDevices = fn.asyncMw(async (req, res) => {
  const deviceNames = req.body || [];
  if (!deviceNames._isArray() || deviceNames.length === 0) {
    return res.status(400).json({
      success: false,
      status: 400,
      error: 'NO_DEVICE_NAMES',
      message: 'Request body must be an array of device names',
    });
  }

  const deviceResponses = (await deviceNames._flatMap(async (deviceName) => {
    const deviceInfo = deviceConfig[fn.slugify(deviceName)] || {};
    let deviceIdsInfo = [];
    try {
      deviceIdsInfo = deviceHelper.getDeviceIdInfo(deviceInfo, deviceName);
      deviceIdsInfo = deviceIdsInfo._uniqBy((deviceIdInfo) => `${deviceIdInfo.platform} - ${deviceIdInfo.id}`);
    } catch (error) {
      if (error.name === 'CIRCULAR_ALIAS') {
        return null;
      }
    }

    if (!deviceIdsInfo || deviceIdsInfo.length === 0) {
      return null;
    }

    return deviceIdsInfo._map(async (deviceIdInfo) => {
      if (deviceIdInfo.platform === 'meross') {
        const deviceResponse = await (await fetch(`${merossFullURL}/device/${deviceIdInfo.mfg_id}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        })).text();

        try {
          return JSON.parse(deviceResponse);
        } catch (e) {
          return null;
        }
      }

      return null;
    });
  }))._filter((deviceResponse) => deviceResponse)[0];

  return res.status(200).json({
    success: true,
    status: 200,
    code: 0,
    devices: deviceResponses || [],
  });
});

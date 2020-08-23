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

exports.getDeviceState = fn.asyncMw(async (req, res) => {
  const deviceNames = req.body || [];
  if (!deviceNames._isArray() || deviceNames.length === 0) {
    return res.status(400).json({
      success: false,
      status: 400,
      error: 'NO_DEVICE_NAMES',
      message: 'Request body must be an array of device names',
    });
  }

  const mfgIds = (await deviceNames._flatMap(async (deviceName) => {
    const deviceInfo = deviceConfig[fn.slugify(deviceName)] || {};

    if (deviceName.match(/^\*/)) {
      const deviceType = deviceName.match(/^\*(.*)/)[1]._lowerCase();
      return deviceConfig._values()._filterMap(
        (device) => (
          device._isPlainObject && (!deviceType || device.type === deviceType)
        ),
        (device) => device.mfg_id,
      );
    }

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
        return deviceIdInfo.mfg_id;
      }

      return null;
    });
  }))._filter((deviceResponse) => deviceResponse)[0];

  const deviceStatesResponse = await fetch(`${merossFullURL}/devices/state`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(mfgIds),
  });

  let deviceStateResponseBody = await deviceStatesResponse.text();

  try {
    deviceStateResponseBody = JSON.parse(deviceStateResponseBody);
    deviceStateResponseBody = deviceStateResponseBody.map((device) => ({
      ...device,
      name: fn.slugify(device.name),
    }));
  } catch (e) {
    // do nothing
  }

  return res.status(deviceStatesResponse.status).json({
    success: deviceStatesResponse.status < 400,
    status: deviceStatesResponse.status,
    code: Number(deviceStatesResponse.status >= 400),
    devices: deviceStateResponseBody || [],
  });
});

const constants = require('../helpers/constants');
const deviceHelper = require('../helpers/deviceHelper');

const {
  _,
  dataFn,
  fn,
} = global;

exports.getDevices = fn.asyncMw(async (req, res) => {
  const roomsById = _.keyBy((await dataFn.findAll('Room')), 'id');
  return fn.sendResponse(req, res, 200, {
    success: true,
    status: 200,
    code: 0,
    devices: await fn.asyncArrayIterator(await dataFn.findAll('Device'), 'map', async (device) => ({
      ...device,
      ...(await Devices[device.mfg_id]?.Device?.getState() || {}),
      actions: constants.deviceActions[device.type] || constants.deviceActions.generic,
      room: roomsById[device.room_id] || null,
    })),
  });
});

exports.getDevice = fn.asyncMw(async (req, res) => {
  const deviceId = Number.parseInt(req.params.deviceId, 10);
  if (Number.isNaN(deviceId)) {
    return fn.sendResponse(req, res, 400, {
      success: false,
      status: 400,
      error: 'INVALID_DEVICE_ID',
      message: `Invalid device ID ${req.params.deviceId}`,
    });
  }

  const device = await dataFn.findOne('Device', { id: deviceId });
  const room = await dataFn.findOne('Room', { id: device.room_id });
  const state = await Devices[device.mfg_id].Device.getState();

  return fn.sendResponse(req, res, 200, {
    success: true,
    status: 200,
    code: 0,
    device: {
      ...device,
      ...state,
      actions: constants.deviceActions[device.type] || constants.deviceActions.generic,
      room,
    },
  });
});

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

  return fn.sendResponse(req, res, 200, {
    success: true,
    status: 200,
    code: 0,
    devices: await deviceHelper.getDeviceStates(deviceNames),
  });
});

/**
 *
 * @deprecated as of version v4.0.0
 * @version v2.0.0
 * @version v2.1.0
 * @version v2.1.1
 * @version v3.0.0
 */
exports.performActionsV2_0_0__V3_0_0 = fn.asyncMw(async (req, res) => {
  const deviceActions = req.body;
  const response = await deviceHelper.performDeviceActionsByNickname(deviceActions);
  return fn.sendResponse(req, res, response.status, response);
});

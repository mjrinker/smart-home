const constants = require('../helpers/constants');
const deviceHelper = require('../helpers/deviceHelper');

const {
  _,
  dataFn,
  fn,
} = global;

exports.getDevices = fn.asyncMw(async (req, res) => {
  const devices = await dataFn.findAll('Device');
  const roomsById = _.keyBy((await dataFn.findAll('Room')), 'id');
  const aliasesByDeviceId = _.groupBy((await dataFn.findAll('Alias', { model: 'device' })), 'modelId');
  const aliasesByRoomId = _.groupBy((await dataFn.findAll('Alias', { model: 'room' })), 'modelId');

  return fn.sendResponse(req, res, 200, {
    success: true,
    status: 200,
    code: 0,
    devices: await fn.asyncArrayIterator(devices, 'map', async (device) => ({
      ...device,
      ...(await Devices[device.mfgId]?.Device?.getState() || {}),
      alias: aliasesByDeviceId[device.id]?.find((alias) => alias.preferred) || device.label,
      aliases: aliasesByDeviceId[device.id] || [],
      actions: constants.deviceActions[device.type] || constants.deviceActions.generic,
      room: roomsById[device.roomId] ? {
        ...roomsById[device.roomId],
        alias: aliasesByRoomId[device.roomId]?.find((alias) => alias.preferred) || roomsById[device.roomId].label,
        aliases: aliasesByRoomId[device.roomId] || [],
      } : null,
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
  const room = await dataFn.findOne('Room', { id: device.roomId });
  const state = await Devices[device.mfgId].Device.getState();
  const aliases = await dataFn.findAll('Alias', { model: 'device', modelId: deviceId });
  const roomAliases = await dataFn.findAll('Alias', { model: 'room', modelId: room.id });

  const groupIds = _.uniq(Object.keys(fn.merge(
    (await deviceHelper.getGroupsForDevices([deviceId])),
    (await deviceHelper.getGroupsForDevicesFromRoomIds([room.id])),
  )));

  const presets = await dataFn.findAll('Preset', [
    {
      model: 'device',
      modelId: deviceId,
    },
    {
      model: 'room',
      modelId: room.id,
    },
    ...(groupIds?.length ? [{
      model: 'group',
      modelId: groupIds,
    }] : [{}]),
  ]);

  return fn.sendResponse(req, res, 200, {
    success: true,
    status: 200,
    code: 0,
    device: {
      ...device,
      ...state,
      alias: aliases.find((alias) => alias.preferred) || device.label,
      aliases,
      actions: constants.deviceActions[device.type] || constants.deviceActions.generic,
      presets,
      room: room ? {
        ...room,
        alias: roomAliases.find((alias) => alias.preferred) || room.label,
        aliases: roomAliases || [],
      } : null,
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

  const deviceNamesOnly = _.uniq(deviceNames.filter((deviceName) => !deviceName.match(/^\*/))
    .map((deviceName) => fn.slugify(deviceName)));
  const deviceTypesOnly = _.uniq(deviceNames.filter((deviceName) => deviceName.match(/^\*/))
    .map((deviceName) => {
      const deviceType = deviceName.match(/^\*(.*)/)[1].toLowerCase();
      return deviceType || '*';
    }));

  const { devicesByNickname } = await deviceHelper.getDevicesByModels(deviceNamesOnly, deviceTypesOnly);
  const devices = _.uniqBy(Object.values(devicesByNickname).flatMap((devices) => devices), 'mfgId');

  const deviceStates = devices.map((device) => {
    if (!Devices[device.mfgId]) {
      return null;
    }
    const { Device } = Devices[device.mfgId];
    return {
      name: Device.name,
      online: Device.online,
      state: Device.state,
      ...(Device.lightValues ? { lightState: Device.lightValues } : {}),
    };
  }).filter((deviceResponse) => deviceResponse) || [];

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

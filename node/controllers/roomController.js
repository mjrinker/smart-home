const envVars = module.parent.exports;
const constants = require('../helpers/constants');
const aliasHelper = require('../helpers/aliasHelper');
const deviceHelper = require('../helpers/deviceHelper');
const roomHelper = require('../helpers/roomHelper');

const {
  fn,
} = envVars;

exports.addAlias = fn.asyncMw(async (req, res) => {
  const { roomId } = req.params;
  const { label, preferred } = req.body;
  if (!global.modelsBy.Room.id[Number(roomId)]) {
    return res.status(404).json({
      success: false,
      status: 404,
      error: 'ROOM_NOT_FOUND',
      message: `Cannot find room id ${roomId}`,
    });
  }

  const room = global.rooms.find((room) => room.id === Number(roomId));

  let alias;
  try {
    alias = await aliasHelper.addAlias('room', roomId, label, !!preferred);
  } catch (error) {
    return res.status(500).json({
      success: false,
      status: 500,
      error: 'ALIAS_NOT_CREATED',
      message: 'Cannot create alias',
    });
  }

  if (alias.error === 'EXISTS') {
    return res.status(409).json({
      success: false,
      status: 409,
      error: 'ALIAS_ALREADY_EXISTS',
      message: `Alias "${label}" for room "${room.label}" already exists`,
    });
  }

  return res.status(201).json({
    success: true,
    status: 201,
    code: 0,
    room,
  });
});

exports.createRoom = fn.asyncMw(async (req, res) => {
  const { label, deviceIds } = req.body;
  const name = fn.slugify(label);
  if (global.modelsBy.Room?.name[name]?.length) {
    return res.status(409).json({
      success: false,
      status: 409,
      error: 'ROOM_ALREADY_EXISTS',
      message: `Room "${label}" already exists`,
    });
  }

  let room;
  try {
    room = await global.models.Room.create({
      name,
      label,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      status: 500,
      error: 'ROOM_NOT_CREATED',
      message: 'Cannot create room',
    });
  }

  // no await
  deviceHelper.reassignDeviceRoom(deviceIds, room.id).then(() => {
    roomHelper.updateModelsByRoomObjects({ newRoom: room.dataValues });
  });

  const roomCopy = {
    ...JSON.parse(JSON.stringify(room)),
    actions: constants.roomActions,
    devices: deviceIds.map((deviceId) => {
      const device = global.modelsBy.Device.id[deviceId][0];
      return fn.filterObjectProperties(device, constants.deviceProps);
    }),
  };

  return res.status(201).json({
    success: true,
    status: 201,
    code: 0,
    room: roomCopy,
  });
});

exports.deleteRoom = fn.asyncMw(async (req, res) => {
  const { roomId } = req.params;

  const roomsWithRoomId = global.modelsBy.Room.id[Number(roomId)];
  const room = Number(Boolean(roomsWithRoomId?.length)) > 0 ? roomsWithRoomId[0] : null;
  if (!room) {
    return res.status(404).json({
      success: false,
      status: 404,
      error: 'ROOM_NOT_FOUND',
      message: `Cannot find room id ${roomId}`,
    });
  }

  // no await
  roomHelper.updateModelsByRoomObjects({ oldRoom: room });

  let success;
  try {
    const deleted = await global.models.Room.destroy({
      where: {
        id: Number(roomId),
      },
    });

    success = !!deleted;
  } catch (error) {
    return res.status(500).json({
      success: false,
      status: 500,
      error: 'ROOM_NOT_DELETED',
      message: `Cannot delete room id ${roomId}`,
    });
  }

  if (!success) {
    return res.status(500).json({
      success: false,
      status: 500,
      error: 'ROOM_NOT_DELETED',
      message: `Cannot delete room id ${roomId}`,
    });
  }

  return res.status(204).send();
});

exports.getRoom = fn.asyncMw(async (req, res) => {
  const { roomId } = req.params;
  const room = global.rooms.find((room) => room.id === Number(roomId));
  if (!room) {
    return res.status(404).json({
      success: false,
      status: 404,
      error: 'ROOM_NOT_FOUND',
      message: `Cannot find room id ${roomId}`,
    });
  }

  return res.json({
    success: true,
    status: 200,
    code: 0,
    room,
  });
});

exports.getRooms = fn.asyncMw(async (req, res) => res.json({
  success: true,
  status: 200,
  code: 0,
  rooms: global.rooms,
}));

exports.reassignRoomDevices = fn.asyncMw(async (req, res) => {
  const { roomId } = req.params;
  const { deviceIds } = req.body;
  deviceHelper.reassignDeviceRoom(deviceIds, Number(roomId));
  return res.status(204).send();
});

exports.removeAlias = fn.asyncMw(async (req, res) => {
  const { aliasId } = req.params;
  if (!global.modelsBy.Alias.id[aliasId]) {
    return res.status(404).json({
      success: false,
      status: 404,
      error: 'ALIAS_NOT_FOUND',
      message: `Cannot find alias id ${aliasId}`,
    });
  }

  try {
    await aliasHelper.removeAlias(aliasId);
  } catch (error) {
    return res.status(500).json({
      success: false,
      status: 500,
      error: 'ALIAS_NOT_DELETED',
      message: `Cannot delete alias id ${aliasId}`,
    });
  }

  return res.status(204).json({
    success: true,
    status: 204,
    code: 0,
  });
});

exports.updateRoom = fn.asyncMw(async (req, res) => {
  const { roomId } = req.params;
  const {
    label,
    orderBetween,
    active,
    deviceIds,
  } = req.body;

  const roomsWithRoomId = global.modelsBy.Room.id[Number(roomId)];
  const room = Number(Boolean(roomsWithRoomId?.length)) > 0 ? roomsWithRoomId[0] : null;
  if (!room) {
    return res.status(404).json({
      success: false,
      status: 404,
      error: 'ROOM_NOT_FOUND',
      message: `Cannot find room id ${roomId}`,
    });
  }

  let order;
  if (orderBetween) {
    const orderBetweenRooms = await global.models.Room.findAll({
      where: {
        id: orderBetween,
      },
      raw: true,
    });

    const orderBetweenOrders = orderBetweenRooms.map((room) => room.order);
    order = Math.round(orderBetweenOrders.reduce((a, b) => (a + b)) / orderBetweenOrders.length);
  }

  const updateObj = {
    ...(label !== undefined ? { name: fn.slugify(label) } : {}),
    ...(label !== undefined ? { label } : {}),
    ...(order !== undefined ? { order } : {}),
    ...(active !== undefined ? { active } : {}),
  };

  const newRoom = {
    ...room,
    ...updateObj,
  };

  // no await
  deviceHelper.reassignDeviceRoom(deviceIds, room.id).then(() => {
    roomHelper.updateModelsByRoomObjects({ newRoom, oldRoom: room });
  });

  let success;
  if (Object.keys(updateObj).length > 0) {
    try {
      const updated = await global.models.Room.update(updateObj, {
        where: {
          id: Number(roomId),
        },
      });

      success = !!updated[0];
    } catch (error) {
      return res.status(500).json({
        success: false,
        status: 500,
        error: 'ROOM_NOT_UPDATED',
        message: `Cannot update room id ${roomId}`,
      });
    }
  } else {
    success = true;
  }

  if (!success) {
    return res.status(500).json({
      success: false,
      status: 500,
      error: 'ROOM_NOT_UPDATED',
      message: `Cannot update room id ${roomId} with values ${JSON.stringify(updateObj)}`,
    });
  }

  return res.status(204).send();
});

/** ******************************************************************************************* **\
 *                                          @deprecated                                          *
\* ********************************************************************************************* */

/**
 *
 * @deprecated as of version v3.0.0
 * @version v2.0.0
 * @version v2.1.0,
 * @version v2.1.1
 */
exports.getRoomsV2_0_0__V2_1_1 = fn.asyncMw(async (req, res) => res.json({
  success: true,
  status: 200,
  code: 0,
  rooms: global.rooms.map((room) => roomHelper.transformRoomV2_0_0__V2_1_1(room)),
}));

/**
 *
 * @deprecated as of version v2.0.0
 * @version v1.0.0
 */
exports.getRoomsV1_0_0 = fn.asyncMw(async (req, res) => (
  res.json(global.rooms.map((room) => roomHelper.transformRoomV1_0_0(room)))
));

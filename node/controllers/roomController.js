const envVars = module.parent.exports;
const constants = require('../helpers/constants');
const aliasHelper = require('../helpers/aliasHelper');
const deviceHelper = require('../helpers/deviceHelper');
const roomHelper = require('../helpers/roomHelper');

const {
  fn,
  sequelize,
} = envVars;

exports.addAlias = fn.asyncMw(async (req, res) => {
  const { roomId } = req.params;
  const { label, preferred } = req.body;
  if (!global.modelsBy.Room.id[Number(roomId)]) {
    return fn.sendResponse(req, res, 404, {
      success: false,
      status: 404,
      error: 'ROOM_NOT_FOUND',
      message: `Cannot find room id ${roomId}`,
    });
  }

  const room = global.rooms.find((room) => room.id === Number(roomId));

  const transaction = await sequelize.transaction();
  let alias;
  try {
    alias = await aliasHelper.addAlias('room', roomId, label, !!preferred, transaction);
  } catch (error) {
    await transaction.rollback();
    return fn.sendResponse(req, res, 500, {
      success: false,
      status: 500,
      error: 'ALIAS_NOT_CREATED',
      message: 'Cannot create alias',
    });
  }

  if (alias.error === 'EXISTS') {
    await transaction.rollback();
    return fn.sendResponse(req, res, 409, {
      success: false,
      status: 409,
      error: 'ALIAS_ALREADY_EXISTS',
      message: `Alias "${label}" for room "${room.label}" already exists`,
    });
  }

  await transaction.commit();

  return fn.sendResponse(req, res, 201, {
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
    return fn.sendResponse(req, res, 409, {
      success: false,
      status: 409,
      error: 'ROOM_ALREADY_EXISTS',
      message: `Room "${label}" already exists`,
    });
  }

  const transaction = await sequelize.transaction();
  let roomCopy;
  try {
    const room = await global.models.Room.create({
      name,
      label,
    }, {
      transaction,
    });

    // no await
    deviceHelper.reassignDeviceRoom(deviceIds, room.id).then(() => {
      roomHelper.updateModelsByRoomObjects({ newRoom: room.dataValues });
    });

    roomCopy = {
      ...JSON.parse(JSON.stringify(room)),
      actions: constants.roomActions,
      devices: deviceIds.map((deviceId) => {
        const device = global.modelsBy.Device.id[deviceId][0];
        return fn.filterObjectProperties(device, constants.deviceProps);
      }),
    };
  } catch (error) {
    await transaction.rollback();
    return fn.sendResponse(req, res, 500, {
      success: false,
      status: 500,
      error: 'ROOM_NOT_CREATED',
      message: 'Cannot create room',
    });
  }

  await transaction.commit();

  return fn.sendResponse(req, res, 201, {
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
    return fn.sendResponse(req, res, 404, {
      success: false,
      status: 404,
      error: 'ROOM_NOT_FOUND',
      message: `Cannot find room id ${roomId}`,
    });
  }

  const transaction = await sequelize.transaction();
  let success;
  try {
    const deleted = await global.models.Room.destroy({
      where: {
        id: Number(roomId),
      },
      transaction,
    });

    success = !!deleted;

    // no await
    roomHelper.updateModelsByRoomObjects({ oldRoom: room });
  } catch (error) {
    await transaction.rollback();
    return fn.sendResponse(req, res, 500, {
      success: false,
      status: 500,
      error: 'ROOM_NOT_DELETED',
      message: `Cannot delete room id ${roomId}`,
    });
  }

  if (!success) {
    await transaction.rollback();
    return fn.sendResponse(req, res, 500, {
      success: false,
      status: 500,
      error: 'ROOM_NOT_DELETED',
      message: `Cannot delete room id ${roomId}`,
    });
  }

  await transaction.commit();
  return fn.sendResponse(req, res, 204);
});

exports.getRoom = fn.asyncMw(async (req, res) => {
  const { roomId } = req.params;
  const room = global.rooms.find((room) => room.id === Number(roomId));
  if (!room) {
    return fn.sendResponse(req, res, 404, {
      success: false,
      status: 404,
      error: 'ROOM_NOT_FOUND',
      message: `Cannot find room id ${roomId}`,
    });
  }

  return fn.sendResponse(req, res, 200, {
    success: true,
    status: 200,
    code: 0,
    room,
  });
});

exports.getRooms = fn.asyncMw(async (req, res) => fn.sendResponse(req, res, 200, {
  success: true,
  status: 200,
  code: 0,
  rooms: global.rooms,
}));

exports.reassignRoomDevices = fn.asyncMw(async (req, res) => {
  const { roomId } = req.params;
  const { deviceIds } = req.body;
  deviceHelper.reassignDeviceRoom(deviceIds, Number(roomId));
  return fn.sendResponse(req, res, 204);
});

exports.removeAlias = fn.asyncMw(async (req, res) => {
  const { aliasId } = req.params;
  if (!global.modelsBy.Alias.id[aliasId]) {
    return fn.sendResponse(req, res, 404, {
      success: false,
      status: 404,
      error: 'ALIAS_NOT_FOUND',
      message: `Cannot find alias id ${aliasId}`,
    });
  }

  const transaction = await sequelize.transaction();
  try {
    await aliasHelper.removeAlias(aliasId, transaction);
  } catch (error) {
    await transaction.rollback();
    return fn.sendResponse(req, res, 500, {
      success: false,
      status: 500,
      error: 'ALIAS_NOT_DELETED',
      message: `Cannot delete alias id ${aliasId}`,
    });
  }

  await transaction.commit();

  return fn.sendResponse(req, res, 204, {
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
    return fn.sendResponse(req, res, 404, {
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

  const transaction = await sequelize.transaction();
  let success;
  if (Object.keys(updateObj).length > 0) {
    try {
      const updated = await global.models.Room.update(updateObj, {
        where: {
          id: Number(roomId),
        },
        transaction,
      });

      success = !!updated[0];

      // no await
      deviceHelper.reassignDeviceRoom(deviceIds, room.id).then(() => {
        roomHelper.updateModelsByRoomObjects({ newRoom, oldRoom: room });
      });
    } catch (error) {
      await transaction.rollback();
      return fn.sendResponse(req, res, 500, {
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
    await transaction.rollback();
    return fn.sendResponse(req, res, 500, {
      success: false,
      status: 500,
      error: 'ROOM_NOT_UPDATED',
      message: `Cannot update room id ${roomId} with values ${JSON.stringify(updateObj)}`,
    });
  }

  await transaction.commit();
  return fn.sendResponse(req, res, 204);
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
exports.getRoomsV2_0_0__V2_1_1 = fn.asyncMw(async (req, res) => fn.sendResponse(req, res, 200, {
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
  fn.sendResponse(req, res, 200, global.rooms.map((room) => roomHelper.transformRoomV1_0_0(room)))
));

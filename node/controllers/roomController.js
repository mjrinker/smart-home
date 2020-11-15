const envVars = module.parent.exports;
const constants = require('../helpers/constants');
const deviceHelper = require('../helpers/deviceHelper');
const roomHelper = require('../helpers/roomHelper');

const {
  fn,
} = envVars;

exports.createRoom = fn.asyncMw(async (req, res) => {
  const { label, deviceIds } = req.body;
  const name = fn.slugify(label);
  if (global.modelsBy.Room.name[name]) {
    return res.status(409).json({
      success: false,
      status: 409,
      error: 'ROOM_ALREADY_EXISTS',
      message: `Room "${label}" already exists`,
    });
  }

  const room = await global.models.Room.create({
    name,
    label,
  }, {
    raw: true,
  });

  // no await
  deviceHelper.reassignDeviceRoom(deviceIds, room.id);

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

exports.updateRoom = fn.asyncMw(async (req, res) => {
  const { roomId } = req.params;
  const {
    label,
    orderBetween,
    active,
    deviceIds,
  } = req.body;

  const room = global.rooms.find((room) => room.id === Number(roomId));
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

  // no await
  deviceHelper.reassignDeviceRoom(deviceIds, room.id);

  let success;
  if (Object.keys(updateObj).length > 0) {
    const updated = await global.models.Room.update(updateObj, {
      where: {
        id: Number(roomId),
      },
    });

    success = !!updated[0];
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

exports.getRoomsV2_0_0__V2_1_1 = fn.asyncMw(async (req, res) => res.json({
  success: true,
  status: 200,
  code: 0,
  rooms: global.rooms.map((room) => roomHelper.transformRoomV2_0_0__V2_1_1(room)),
}));

exports.getRoomsV1_0_0 = fn.asyncMw(async (req, res) => (
  res.json(global.rooms.map((room) => roomHelper.transformRoomV1_0_0(room)))
));

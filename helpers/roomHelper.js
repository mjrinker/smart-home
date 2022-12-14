const deviceHelper = require('./deviceHelper');

const {
  _,
  dataFn,
  fn,
} = global;

exports.transformRoomV2_0_0__V2_1_1 = (room) => fn.filterObjectProperties(room, ['name', 'label', 'actions']);

exports.transformRoomV1_0_0 = (room) => {
  const roomCopy = fn.filterObjectProperties(_.cloneDeep(room), ['name', 'label', 'actions']);
  roomCopy.names = [roomCopy.name];
  delete roomCopy.name;
  return roomCopy;
};

exports.updateModelsByRoomObjects = async ({ newRoom, oldRoom }) => {
  if (_.isPlainObject(oldRoom) && !_.isPlainObject(newRoom)) {
    // eslint-disable-next-line camelcase
    const oldRoomDevices = await dataFn.findAll('Device', { roomId: oldRoom.id });
    const oldRoomDevicesIds = oldRoomDevices.map((device) => device.id);
    deviceHelper.reassignDeviceRoom(oldRoomDevicesIds, null); // no await
  }

  return true;
};

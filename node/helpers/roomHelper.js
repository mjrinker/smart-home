const envVars = module.parent.parent.exports;
const constants = require('./constants');
const deviceHelper = require('./deviceHelper');

const {
  _,
  fn,
} = envVars;

exports.transformRoomV2_0_0__V2_1_1 = (room) => fn.filterObjectProperties(room, ['name', 'label', 'actions']);

exports.transformRoomV1_0_0 = (room) => {
  const roomCopy = fn.filterObjectProperties(_.cloneDeep(room), ['name', 'label', 'actions']);
  roomCopy.names = [roomCopy.name];
  delete roomCopy.name;
  return roomCopy;
};

exports.updateModelsByRoomObjects = async ({ newRoom, oldRoom }) => {
  if (_.isPlainObject(oldRoom)) {
    Object.entries(oldRoom).forEach(([field, value]) => {
      const groupByField = field === 'model_id' ? (oldRoom) => `${oldRoom.model}_${oldRoom.model_id}` : field;
      const groupByValue = typeof value === 'boolean' ? Number(value) : value;
      const roomGroup = global.modelsBy.Room[groupByField][groupByValue];
      if (Array.isArray(roomGroup)) {
        const oldRoomIndex = _.findIndex(roomGroup, { id: oldRoom.id });
        roomGroup.splice(oldRoomIndex, 1);
      }
    });

    const roomIndex = _.findIndex(global.rooms, { id: oldRoom.id });
    if (_.isPlainObject(newRoom)) {
      global.rooms[roomIndex] = {
        id: newRoom.id,
        label: newRoom.label,
        name: newRoom.name,
        actions: constants.roomActions,
        devices: global.modelsBy.Device.room_id[newRoom.id]?.map((device) => (
          fn.filterObjectProperties(device, constants.deviceProps)
        )) || [],
      };
    } else {
      const oldRoomDevices = global.modelsBy.Device.room_id[oldRoom.id] || [];
      const oldRoomDevicesIds = oldRoomDevices.map((device) => device.id);
      deviceHelper.reassignDeviceRoom(oldRoomDevicesIds, null); // no await
      global.rooms.splice(roomIndex, 1);
    }
  }

  if (_.isPlainObject(newRoom)) {
    Object.entries(newRoom).forEach(([field, value]) => {
      const groupByField = field === 'model_id' ? (newRoom) => `${newRoom.model}_${newRoom.model_id}` : field;
      const groupByValue = typeof value === 'boolean' ? Number(value) : value;
      const roomGroup = global.modelsBy.Room[groupByField][groupByValue];
      if (Array.isArray(roomGroup)) {
        roomGroup.push(newRoom);
      } else {
        global.modelsBy.Room[groupByField][groupByValue] = [newRoom];
      }
    });

    if (!_.isPlainObject(oldRoom)) {
      global.rooms.push({
        id: newRoom.id,
        label: newRoom.label,
        name: newRoom.name,
        actions: constants.roomActions,
        devices: global.modelsBy.Device.room_id[newRoom.id]?.map((device) => (
          fn.filterObjectProperties(device, constants.deviceProps)
        )) || [],
      });
    }
  }

  return true;
};

const envVars = module.parent.parent.exports;

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

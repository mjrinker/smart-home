const envVars = module.parent.exports;
const {
  _,
  fn,
  rooms,
} = envVars;

exports.getRoomsV1_0_0 = fn.asyncMw(async (req, res) => {
  const roomsCopy = rooms.map((room) => {
    const roomCopy = fn.filterObjectProperties(_.cloneDeep(room), ['name', 'label', 'actions']);
    roomCopy.names = [roomCopy.name];
    delete roomCopy.name;
    return roomCopy;
  });

  return res.json(roomsCopy);
});

exports.getRoomsV2_0_0__V2_1_1 = fn.asyncMw(async (req, res) => res.json({
  success: true,
  status: 200,
  code: 0,
  rooms: rooms.map((room) => fn.filterObjectProperties(room, ['name', 'label', 'actions'])),
}));

exports.getRooms = fn.asyncMw(async (req, res) => res.json({
  success: true,
  status: 200,
  code: 0,
  rooms,
}));

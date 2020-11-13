const envVars = module.parent.exports;
const {
  _,
  fn,
  rooms,
} = envVars;

exports.getRoomsV1_0_0 = fn.asyncMw(async (req, res) => {
  const roomsCopy = rooms.map((room) => {
    const roomCopy = _.cloneDeep(room);
    roomCopy.names = [roomCopy.name];
    delete roomCopy.name;
    return roomCopy;
  });

  return res.json(roomsCopy);
});

exports.getRooms = fn.asyncMw(async (req, res) => res.json({
  success: true,
  status: 200,
  code: 0,
  rooms,
}));

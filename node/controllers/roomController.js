const envVars = module.parent.exports;
const {
  fn,
  rooms,
} = envVars;

exports.getRoomsV1_0_0 = fn.asyncMw(async (req, res) => {
  const roomsCopy = rooms._map((room) => {
    const roomCopy = room._cloneDeep();
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

exports.deviceProps = ['id', 'mfg_id', 'name', 'label', 'platform', 'type'];

exports.roomActions = [
  {
    action: 'off',
    value: true,
  },
  {
    action: 'on',
    value: true,
  },
];

exports.fadeDelay = 5;
exports.fadeIncrement = 2;

exports.authTypes = {
  PASSWORD: 'password',
  GOOGLE: 'google',
};

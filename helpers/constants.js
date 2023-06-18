exports.deviceProps = ['id', 'mfg_id', 'name', 'label', 'platform', 'type', 'state', 'online', 'light_state'];

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

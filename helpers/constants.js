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

exports.deviceActions = {
  generic: [
    {
      action: 'off',
      value: true,
    },
    {
      action: 'on',
      value: true,
    },
  ],
  bulb: [
    {
      action: 'off',
      value: true,
    },
    {
      action: 'on',
      value: true,
    },
    {
      action: 'brightness',
      value: 'number',
    },
    {
      action: 'temperature',
      value: 'number',
    },
    {
      action: 'color',
      value: 'string',
    },
  ],
  socket: [
    {
      action: 'off',
      value: true,
    },
    {
      action: 'on',
      value: true,
    },
  ],
  thermostat: [
    {
      action: 'off',
      value: true,
    },
    {
      action: 'on',
      value: true,
    },
    {
      action: 'temperature',
      value: 'number',
    },
    {
      action: 'speed',
      value: 'number',
    },
    {
      action: 'mode',
      value: 'number',
    },
  ],
  fan: [
    {
      action: 'off',
      value: true,
    },
    {
      action: 'on',
      value: true,
    },
    {
      action: 'speed',
      value: 'number',
    },
    {
      action: 'direction',
      value: 'number',
    },
  ],
  garage: [
    {
      action: 'off',
      value: true,
    },
    {
      action: 'on',
      value: true,
    },
    {
      action: 'open',
      value: true,
    },
    {
      action: 'close',
      value: true,
    },
  ],
  switch: [
    {
      action: 'off',
      value: true,
    },
    {
      action: 'on',
      value: true,
    },
  ],
  dimmer: [
    {
      action: 'off',
      value: true,
    },
    {
      action: 'on',
      value: true,
    },
    {
      action: 'brightness',
      value: 'number',
    },
  ],
};

exports.fadeDelay = 5;
exports.fadeIncrement = 2;

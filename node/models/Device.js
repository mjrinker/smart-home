module.exports = (params) => {
  class Device extends params.Model {}
  Device.init({
    mfg_id: {
      type: params.DataTypes.STRING(64),
      allowNull: false,
    },
    room_id: {
      type: params.DataTypes.INTEGER.UNSIGNED,
    },
    name: {
      type: params.DataTypes.STRING,
      allowNull: false,
    },
    label: {
      type: params.DataTypes.STRING,
      allowNull: false,
    },
    platform: {
      type: params.DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: params.DataTypes.ENUM('bulb', 'socket', 'thermostat', 'fan', 'garage'),
      allowNull: false,
    },
    order: {
      type: params.DataTypes.INTEGER,
      defaultValue: 2147483647,
    },
    active: {
      type: params.DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    sequelize: params.sequelize,
    modelName: 'device',
    timestamps: false,
  });

  return Device;
};

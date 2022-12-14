module.exports = (params) => {
  class Device extends params.Model { }
  Device.init({
    mfgId: {
      type: params.DataTypes.STRING(64),
      allowNull: false,
    },
    roomId: {
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
    mfgModel: {
      type: params.DataTypes.STRING,
      allowNull: true,
    },
    mfgSubModel: {
      type: params.DataTypes.STRING,
      allowNull: true,
    },
    firmwareVersion: {
      type: params.DataTypes.STRING,
      allowNull: true,
    },
    hardwareVersion: {
      type: params.DataTypes.STRING,
      allowNull: true,
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
    underscored: true,
    timestamps: false,
  });

  return Device;
};

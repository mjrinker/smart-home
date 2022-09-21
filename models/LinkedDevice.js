module.exports = (params) => {
  class LinkedDevice extends params.Model { }
  LinkedDevice.init({
    source_device_id: {
      type: params.DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    target_model: {
      type: params.DataTypes.ENUM('device', 'room', 'group'),
      allowNull: false,
    },
    target_model_id: {
      type: params.DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    name: {
      type: params.DataTypes.STRING,
      allowNull: false,
    },
    label: {
      type: params.DataTypes.STRING,
      allowNull: false,
    },
    event: {
      type: params.DataTypes.STRING,
      allowNull: false,
    },
    action: {
      type: params.DataTypes.STRING,
      allowNull: false,
    },
    value: {
      type: params.DataTypes.STRING,
    },
    datatype: {
      type: params.DataTypes.ENUM('null', 'boolean', 'number', 'string'),
    },
    active: {
      type: params.DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    sequelize: params.sequelize,
    modelName: 'linked_devices',
    freezeTableName: true,
    timestamps: false,
  });

  return LinkedDevice;
};

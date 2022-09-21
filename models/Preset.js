module.exports = (params) => {
  class Preset extends params.Model { }
  Preset.init({
    model: {
      type: params.DataTypes.ENUM('device', 'room', 'group'),
      allowNull: false,
    },
    model_id: {
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
    active: {
      type: params.DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    sequelize: params.sequelize,
    modelName: 'preset',
    timestamps: false,
  });

  return Preset;
};

module.exports = (params) => {
  class Preset extends params.Model { }
  Preset.init({
    model: {
      type: params.DataTypes.ENUM('device', 'room', 'group'),
      allowNull: false,
    },
    modelId: {
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
    underscored: true,
    timestamps: false,
  });

  return Preset;
};

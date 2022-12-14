module.exports = (params) => {
  class PresetAction extends params.Model { }
  PresetAction.init({
    presetId: {
      type: params.DataTypes.INTEGER.UNSIGNED,
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
    modelName: 'preset_action',
    underscored: true,
    timestamps: false,
  });

  return PresetAction;
};

module.exports = (params) => {
  class PresetAction extends params.Model {}
  PresetAction.init({
    preset_id: {
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
    timestamps: false,
  });

  return PresetAction;
};

module.exports = (params) => {
  class ConditionalAction extends params.Model {}
  ConditionalAction.init({
    model: {
      type: params.DataTypes.ENUM('device', 'room', 'group'),
      allowNull: false,
    },
    model_id: {
      type: params.DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    preset_id: {
      type: params.DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    action: {
      type: params.DataTypes.STRING,
      allowNull: false,
    },
    condition_type: {
      type: params.DataTypes.ENUM('time'),
      allowNull: false,
    },
    condition: {
      type: params.DataTypes.STRING,
    },
    active: {
      type: params.DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    sequelize: params.sequelize,
    modelName: 'conditional_actions',
    freezeTableName: true,
    timestamps: false,
  });

  return ConditionalAction;
};

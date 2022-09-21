module.exports = (params) => {
  class SceneAction extends params.Model { }
  SceneAction.init({
    scene_id: {
      type: params.DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    model: {
      type: params.DataTypes.ENUM('device', 'room', 'group'),
      allowNull: false,
    },
    model_id: {
      type: params.DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    action: {
      type: params.DataTypes.STRING,
    },
    value: {
      type: params.DataTypes.STRING,
      allowNull: false,
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
    modelName: 'scene_action',
    timestamps: false,
  });

  return SceneAction;
};

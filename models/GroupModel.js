module.exports = (params) => {
  class GroupModel extends params.Model { }
  GroupModel.init({
    groupId: {
      type: params.DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    model: {
      type: params.DataTypes.ENUM('device', 'room', 'group'),
      allowNull: false,
    },
    modelId: {
      type: params.DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    active: {
      type: params.DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    sequelize: params.sequelize,
    modelName: 'groups_models',
    freezeTableName: true,
    underscored: true,
    timestamps: false,
  });

  return GroupModel;
};

module.exports = (params) => {
  class Group extends params.Model {}
  Group.init({
    name: {
      type: params.DataTypes.STRING,
      allowNull: false,
    },
    label: {
      type: params.DataTypes.STRING,
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
    modelName: 'group',
    timestamps: false,
  });

  return Group;
};

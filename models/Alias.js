module.exports = (params) => {
  class Alias extends params.Model { }
  Alias.init({
    model: {
      type: params.DataTypes.ENUM('device', 'room', 'group'),
      allowNull: false,
    },
    modelId: {
      type: params.DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    alias: {
      type: params.DataTypes.STRING,
      allowNull: false,
    },
    label: {
      type: params.DataTypes.STRING,
      allowNull: false,
    },
    preferred: {
      type: params.DataTypes.BOOLEAN,
      defaultValue: false,
    },
    active: {
      type: params.DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    sequelize: params.sequelize,
    modelName: 'alias',
    underscored: true,
    timestamps: false,
  });

  return Alias;
};

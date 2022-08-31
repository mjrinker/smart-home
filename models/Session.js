module.exports = (params) => {
  class Session extends params.Model {}
  Session.init({
    userId: {
      type: params.DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    refreshToken: {
      type: params.DataTypes.STRING,
      allowNull: false,
    },
    userAgent: {
      type: params.DataTypes.STRING,
      allowNull: true,
    },
    active: {
      type: params.DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    sequelize: params.sequelize,
    modelName: 'token',
    timestamps: false,
  });

  return Session;
};

module.exports = (params) => {
  class AuthCode extends params.Model {}
  AuthCode.init({
    userId: {
      type: params.DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    authCode: {
      type: params.DataTypes.STRING,
      allowNull: false,
    },
  }, {
    sequelize: params.sequelize,
    modelName: 'token',
    timestamps: false,
  });

  return AuthCode;
};

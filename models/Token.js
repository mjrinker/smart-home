module.exports = (params) => {
  class Token extends params.Model {}
  Token.init({
    userId: {
      type: params.DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    refreshToken: {
      type: params.DataTypes.STRING,
      allowNull: false,
    },
  }, {
    sequelize: params.sequelize,
    modelName: 'token',
    timestamps: false,
  });

  return Token;
};

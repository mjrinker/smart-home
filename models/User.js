module.exports = (params) => {
  class User extends params.Model {}
  User.init({
    name: {
      type: params.DataTypes.STRING,
      allowNull: false,
    },
    username: {
      type: params.DataTypes.STRING,
    },
    email: {
      type: params.DataTypes.STRING,
      allowNull: false,
    },
    password: {
      type: params.DataTypes.STRING,
      allowNull: false,
    },
  }, {
    sequelize: params.sequelize,
    modelName: 'user',
    timestamps: false,
  });

  return User;
};

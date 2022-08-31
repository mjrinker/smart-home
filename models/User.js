const constants = require('../helpers/constants');

module.exports = (params) => {
  class User extends params.Model {}
  User.init({
    name: {
      type: params.DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: params.DataTypes.STRING,
      allowNull: false,
    },
    password: {
      type: params.DataTypes.STRING,
      allowNull: false,
    },
    picture: {
      type: params.DataTypes.STRING,
      allowNull: true,
    },
    authType: {
      type: params.DataTypes.ENUM(...Object.values(constants.authTypes)),
      defaultValue: constants.authTypes.PASSWORD,
    },
    active: {
      type: params.DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    sequelize: params.sequelize,
    modelName: 'user',
    timestamps: false,
  });

  return User;
};

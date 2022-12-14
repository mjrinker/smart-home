module.exports = (params) => {
  class Color extends params.Model { }
  Color.init({
    name: {
      type: params.DataTypes.STRING,
      allowNull: false,
    },
    label: {
      type: params.DataTypes.STRING,
      allowNull: false,
    },
    value: {
      type: params.DataTypes.STRING(9),
      allowNull: false,
    },
    displayValue: {
      type: params.DataTypes.STRING(9),
      allowNull: false,
    },
    active: {
      type: params.DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    sequelize: params.sequelize,
    modelName: 'color',
    underscored: true,
    timestamps: false,
  });

  return Color;
};

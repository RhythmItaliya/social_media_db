'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class admins extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {

      admins.hasMany(models.users);
    }
  }
  admins.init({
    username: {
      allowNull: false,
      type: DataTypes.STRING
    },
    email: {
      allowNull: false,
      type: DataTypes.STRING
    },
    password: {
      allowNull: false,
      type: DataTypes.STRING
    },
    isActive: {
      allowNull: false,
      type: DataTypes.BOOLEAN,
      defaultValue: 0
    },
    token: {
      allowNull: false,
      type: DataTypes.UUID
    },
    uuid: {
      allowNull: false,
      type: DataTypes.UUID,
      defaultValue: 1
    },
  }, {
    sequelize,
    modelName: 'admins',
  });

  admins.beforeSave('dcryptPass', (data, _) => {
    const bcrypt = require('bcrypt');
    let plainPass = data.getDataValue('password');
    let ecryptPass = bcrypt.hashSync(plainPass, 10);
    data.setDataValue('password', ecryptPass);
  });

  return admins;
};
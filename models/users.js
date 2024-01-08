'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class users extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of DataTypes lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      users.hasOne(models.userProfiles, { foreignKey: 'userId' });
    }
  }
  users.init({
    username: {
      allowNull: false,
      type: DataTypes.STRING,
      validate: {
        len: [3, 255],
      }
    },
    email: {
      allowNull: false,
      type: DataTypes.STRING,
      validate: {
        isEmail: true,
      }
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
      defaultValue: DataTypes.UUIDV4
    },
  }, {
    sequelize,
    modelName: 'users',
  });

  users.beforeSave('dcryptPass', (data, _) => {
    const bcrypt = require('bcrypt');
    let plainPass = data.getDataValue('password');
    let ecryptPass = bcrypt.hashSync(plainPass, 10);
    data.setDataValue('password', ecryptPass);
  });
  return users;
};
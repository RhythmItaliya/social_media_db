'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class defaultAvatars extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  defaultAvatars.init({
    defaultAvatarURL: {
      allowNull: false,
      type: DataTypes.STRING
    },
    uuid: {
      allowNull: false,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
  }, {
    sequelize,
    modelName: 'defaultAvatars',
  });
  return defaultAvatars;
};
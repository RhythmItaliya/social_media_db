'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class friendRequests extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {

      friendRequests.belongsTo(models.userProfiles, { foreignKey: 'senderId', as: 'sender' });
      friendRequests.belongsTo(models.userProfiles, { foreignKey: 'receiverId', as: 'receiver' });

    }
  }
  friendRequests.init({
    senderId: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    receiverId: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    status: {
      allowNull: false,
      type: DataTypes.ENUM('1', '2', '3'),
      defaultValue: '1',
    },
    uuid: {
      allowNull: false,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
  }, {
    sequelize,
    modelName: 'friendRequests',
  });
  return friendRequests;
};
'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class messages extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // New association for the sender of the message
      messages.belongsTo(models.userProfiles, { foreignKey: 'senderId', as: 'sender' });
      messages.belongsTo(models.userProfiles, { foreignKey: 'receiverId', as: 'receiver' });

    }
  }
  messages.init({
    senderId: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    receiverId: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    content: {
      allowNull: false,
      type: DataTypes.TEXT
    },
    roomId: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    uuid: {
      allowNull: false,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
  }, {
    sequelize,
    modelName: 'messages',
  });
  return messages;
};
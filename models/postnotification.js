'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class postNotification extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {

      // postNotification
      postNotification.belongsTo(models.userPosts, { foreignKey: 'postId', as: 'post' });

    }
  }
  postNotification.init({
    postId: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    notificationMessage: {
      allowNull: false,
      type: DataTypes.STRING
    },
    isRead: {
      allowNull: false,
      type: DataTypes.BOOLEAN,
      defaultValue: 0
    },
    uuid: {
      allowNull: false,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
  }, {
    sequelize,
    modelName: 'postNotification',
  });
  return postNotification;
};
'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class userPosts extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      userPosts.belongsTo(models.userProfiles, { foreignKey: 'userProfileId', as: 'user', });
    }
  }
  userPosts.init({
    userProfileId: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    postText: {
      type: DataTypes.TEXT
    },
    isPhoto: {
      allowNull: false,
      type: DataTypes.BOOLEAN,
      defaultValue: 0
    },
    caption: {
      type: DataTypes.TEXT
    },
    location: {
      type: DataTypes.STRING
    },
    isVisibility: {
      allowNull: false,
      type: DataTypes.BOOLEAN,
      defaultValue: 0
    },
    postUploadURLs: {
      allowNull: false,
      type: DataTypes.STRING
    },
    hashtags: {
      type: DataTypes.STRING
    },
    uuid: {
      allowNull: false,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
  }, {
    sequelize,
    modelName: 'userPosts',
  });
  return userPosts;
};
'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class userProfiles extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of DataTypes lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {

      // users
      userProfiles.belongsTo(models.users, { foreignKey: 'userId' });

      // profile photo
      userProfiles.hasOne(models.profilePhotes, { foreignKey: 'userProfileId' });

      // friends
      userProfiles.belongsToMany(models.userProfiles, { through: 'friendships', as: 'friends', foreignKey: 'userProfile1Id', otherKey: 'userProfile2Id' });
      userProfiles.belongsToMany(models.userProfiles, { through: 'friendRequests', as: 'sentFriendRequests', foreignKey: 'senderId', otherKey: 'receiverId' });
      userProfiles.belongsToMany(models.userProfiles, { through: 'friendRequests', as: 'receivedFriendRequests', foreignKey: 'receiverId', otherKey: 'senderId' });

      // sent messages
      userProfiles.hasMany(models.messages, { foreignKey: 'senderId', as: 'sentMessages' });
      userProfiles.hasMany(models.messages, { foreignKey: 'receiverId', as: 'receivedMessages' });

      // posts
      userProfiles.hasMany(models.userPosts, { foreignKey: 'userProfileId', as: 'posts', });

      // comment
      userProfiles.hasMany(models.postComments, { foreignKey: 'userProfileId', as: 'postComments', });

      // crushes
      userProfiles.hasMany(models.crushes, { foreignKey: 'userProfile1Id', as: 'crushes1' });
      userProfiles.hasMany(models.crushes, { foreignKey: 'userProfile2Id', as: 'crushes2' });

      // ignores
      userProfiles.hasMany(models.ignores, { foreignKey: 'userProfile1Id', as: 'ignores1' });
      userProfiles.hasMany(models.ignores, { foreignKey: 'userProfile2Id', as: 'ignores2' });

      // likes
      userProfiles.hasMany(models.postLikes, { foreignKey: 'userProfileId', as: 'likedPosts' });

      // stories
      userProfiles.hasMany(models.stories, { foreignKey: 'userProfileId', as: 'stories' });

      // rattings
      userProfiles.hasMany(models.ratings, { foreignKey: 'rateUserProfile1Id', as: 'givenRatings' });
      userProfiles.hasMany(models.ratings, { foreignKey: 'rateUserProfile2Id', as: 'receivedRatings' });
    }
  }

  userProfiles.init({
    userId: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    firstName: {
      // allowNull: false,
      type: DataTypes.STRING
    },
    lastName: {
      // allowNull: false,
      type: DataTypes.STRING
    },
    gender: {
      // allowNull: false,
      type: DataTypes.STRING
    },
    birthdate: {
      // allowNull: false,
      type: DataTypes.DATE
    },
    location: {
      // allowNull: false,
      type: DataTypes.STRING
    },
    bio: {
      // allowNull: false,
      type: DataTypes.TEXT
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: 0,
    },
    darkMode: {
      allowNull: false,
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    token: {
      allowNull: false,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV1
    },
    uuid: {
      allowNull: false,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
  }, {
    sequelize,
    modelName: 'userProfiles',
  });
  return userProfiles;
};
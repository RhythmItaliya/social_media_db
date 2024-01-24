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
      userProfiles.belongsToMany(models.userProfiles, {
        through: 'friendships',
        as: 'friends',
        foreignKey: 'userProfile1Id',
        otherKey: 'userProfile2Id',
      });

      userProfiles.belongsToMany(models.userProfiles, {
        through: 'friendRequests',
        as: 'sentFriendRequests',
        foreignKey: 'senderId',
        otherKey: 'receiverId',
      });

      userProfiles.belongsToMany(models.userProfiles, {
        through: 'friendRequests',
        as: 'receivedFriendRequests',
        foreignKey: 'receiverId',
        otherKey: 'senderId',
      });

      // sent messages
      userProfiles.hasMany(models.messages, { foreignKey: 'senderId', as: 'sentMessages' });
      userProfiles.hasMany(models.messages, { foreignKey: 'receiverId', as: 'receivedMessages' });

      // posts
      userProfiles.hasMany(models.userPosts, { foreignKey: 'userProfileId', as: 'posts', });

      //
      userProfiles.hasMany(models.postComments, { foreignKey: 'userProfileId', as: 'postComments', });
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
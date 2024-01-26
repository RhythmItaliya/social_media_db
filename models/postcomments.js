'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class postComments extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {

      postComments.belongsTo(models.userProfiles, { foreignKey: 'userProfileId', as: 'userComment', });
      postComments.belongsTo(models.userPosts, { foreignKey: 'postId', as: 'post', });

      postComments.hasMany(models.commentLikes, { foreignKey: 'commentId', as: 'likes', });

    }
  }
  postComments.init({
    postId: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    userProfileId: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    commentText: {
      allowNull: false,
      type: DataTypes.TEXT
    },
    isDeleted: {
      allowNull: false,
      type: DataTypes.BOOLEAN,
      defaultValue: 0
    },
    commentReaction: {
      allowNull: false,
      type: DataTypes.STRING
    },
    reactionCount: {
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    uuid: {
      allowNull: false,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
  }, {
    sequelize,
    modelName: 'postComments',
  });
  return postComments;
};
'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class postLikes extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      postLikes.belongsTo(models.userProfiles, { foreignKey: 'userProfileId', as: 'liker' });
      postLikes.belongsTo(models.userPosts, { foreignKey: 'postId', as: 'post' });
    }
  }
  postLikes.init({
    userProfileId: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    postId: {
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
    modelName: 'postLikes',
  });
  return postLikes;
};

'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class commentLikes extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {

      commentLikes.belongsTo(models.userProfiles, { foreignKey: 'userProfileId', as: 'liker', });
      commentLikes.belongsTo(models.postComments, { foreignKey: 'commentId', as: 'comment', });

    }
  }
  commentLikes.init({
    userProfileId: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    commentId: {
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
    modelName: 'commentLikes',
  });
  return commentLikes;
};
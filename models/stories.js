'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class stories extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {

      // In stories model's associate method
      stories.belongsTo(models.userProfiles, { foreignKey: 'userProfileId', as: 'author' });

      // In stories model's associate method
      stories.belongsToMany(models.userProfiles, { through: 'storyViews', as: 'viewers' });

    }
  }
  stories.init({
    userProfileId: {
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    text: {
      allowNull: true,
      type: DataTypes.STRING
    },
    textColor: {
      allowNull: false,
      type: DataTypes.STRING
    },
    image: {
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
    modelName: 'stories',
  });
  return stories;
};
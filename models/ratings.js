'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ratings extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      ratings.belongsTo(models.userProfiles, { foreignKey: 'rateUserProfile1Id', as: 'ratedUserProfile' });
      ratings.belongsTo(models.userProfiles, { foreignKey: 'rateUserProfile2Id', as: 'ratingUserProfile' });
    }
  }
  ratings.init({
    rateUserProfile1Id: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    rateUserProfile2Id: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    rating: {
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
    modelName: 'ratings',
  });
  return ratings;
};
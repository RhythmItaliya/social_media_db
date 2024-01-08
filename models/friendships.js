'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class friendships extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {

      friendships.belongsTo(models.userProfiles, { foreignKey: 'userProfile1Id', as: 'userProfile1' });
      friendships.belongsTo(models.userProfiles, { foreignKey: 'userProfile2Id', as: 'userProfile2' });

    }
  }
  friendships.init({
    userProfile1Id: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    userProfile2Id: {
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
    modelName: 'friendships',
  });
  return friendships;
};
'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class profilePhotes extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      profilePhotes.belongsTo(models.userProfiles, { foreignKey: 'userProfileId' });
    }
  }
  profilePhotes.init({
    userProfileId: {
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    photoURL: {
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
    modelName: 'profilePhotes',
  });
  return profilePhotes;
};
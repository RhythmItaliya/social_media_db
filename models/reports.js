'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class reports extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {

      reports.belongsTo(models.userProfiles, { foreignKey: 'userID' });
      reports.belongsTo(models.userPosts, { foreignKey: 'postID' });
    }
  }
  reports.init({
    userID: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    postID: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    reports: {
      allowNull: false,
      type: DataTypes.TEXT
    },
    isSolve: {
      allowNull: false,
      type: DataTypes.BOOLEAN,
      defaultValue: 0
    },
    uuid: {
      allowNull: false,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
  }, {
    sequelize,
    modelName: 'reports',
  });
  return reports;
};
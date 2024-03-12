'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ignores extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {

      ignores.belongsTo(models.userProfiles, { foreignKey: 'userProfile1Id', as: 'userProfile1' });
      ignores.belongsTo(models.userProfiles, { foreignKey: 'userProfile2Id', as: 'userProfile2' });

    }
  }
  ignores.init({
    userProfile1Id: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    userProfile2Id: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    status: {
      allowNull: false,
      type: DataTypes.ENUM('1', '2', '3'),
      defaultValue: '1',
    },
    uuid: {
      allowNull: false,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
  }, {
    sequelize,
    modelName: 'ignores',
  });
  return ignores;
};
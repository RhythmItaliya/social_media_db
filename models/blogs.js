'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class blogs extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of DataTypes lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {

      blogs.hasMany(models.blogComments, { foreignKey: 'blogId', as: 'comments' });
    }
  }
  blogs.init({
    title: {
      allowNull: false,
      type: DataTypes.STRING
    },
    isPublic: {
      allowNull: false,
      type: DataTypes.BOOLEAN,
      defaultValue: 0
    },
    contentarea: {
      allowNull: false,
      type: DataTypes.TEXT
    },
    blogURL: {
      allowNull: false,
      type: DataTypes.STRING
    },
    keyword: {
      allowNull: false,
      type: DataTypes.STRING
    },
    comment: {
      type: DataTypes.INTEGER
    },
    uuid: {
      allowNull: false,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
  }, {
    sequelize,
    modelName: 'blogs',
  });
  return blogs;
};
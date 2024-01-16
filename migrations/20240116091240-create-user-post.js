'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('userPosts', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userProfileId: {
        type: Sequelize.INTEGER
      },
      postText: {
        type: Sequelize.TEXT
      },
      isPhoto: {
        type: Sequelize.BOOLEAN
      },
      caption: {
        type: Sequelize.TEXT
      },
      location: {
        type: Sequelize.STRING
      },
      isVisibility: {
        type: Sequelize.BOOLEAN
      },
      postUploadURLs: {
        type: Sequelize.STRING
      },
      hashtags: {
        type: Sequelize.STRING
      },
      uuid: {
        type: Sequelize.UUID
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('userPosts');
  }
};
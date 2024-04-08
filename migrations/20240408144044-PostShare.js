'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('userPosts', 'sharLink', {
      allowNull: false,
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn('userPosts', 'sharCount', {
      allowNull: false,
      type: Sequelize.INTEGER,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('userPosts', 'sharLink');
    await queryInterface.removeColumn('userPosts', 'sharCount');
  }
};
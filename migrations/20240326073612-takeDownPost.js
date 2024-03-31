'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('userPosts', 'isTakeDown', {
      allowNull: false,
      type: Sequelize.BOOLEAN,
      defaultValue: 0
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('userPosts', 'isTakeDown');
  },
};
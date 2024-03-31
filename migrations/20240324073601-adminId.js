'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'adminId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'adminId');
  },
};

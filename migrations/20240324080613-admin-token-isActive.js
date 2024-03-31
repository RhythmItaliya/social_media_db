'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('admins', 'token', {
      allowNull: false,
      type: Sequelize.UUID
    });
    await queryInterface.addColumn('admins', 'isActive', {
      allowNull: false,
      type: Sequelize.BOOLEAN,
      defaultValue: 0
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('admins', 'token');
    await queryInterface.removeColumn('admins', 'isActive');
  },
};
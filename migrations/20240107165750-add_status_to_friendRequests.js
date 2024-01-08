// migrations/<timestamp>-add_status_to_friendRequests.js

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('friendRequests', 'status', {
      type: Sequelize.ENUM('1', '2', '3'),
      allowNull: false,
      defaultValue: '1',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('friendRequests', 'status');
  },
};

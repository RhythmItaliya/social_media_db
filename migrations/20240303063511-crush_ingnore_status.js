'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('crushes', 'status', {
      type: Sequelize.ENUM('1', '2', '3'),
      allowNull: false,
      defaultValue: '1',
    });

    await queryInterface.addColumn('ignores', 'status', {
      type: Sequelize.ENUM('1', '2', '3'),
      allowNull: false,
      defaultValue: '1',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('crushes', 'status');

    await queryInterface.removeColumn('ignores', 'status');
  },
};
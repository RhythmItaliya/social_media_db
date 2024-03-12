'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('userProfiles', 'isPublic', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: 0,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('userProfiles', 'isPublic');
  },
};

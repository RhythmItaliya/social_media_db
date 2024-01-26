// migrations/<timestamp>-postCommentsReactionCount.js

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('postComments', 'reactionCount', {
      type: Sequelize.INTEGER,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('postComments', 'reactionCount');
  },
};

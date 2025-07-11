module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('rankings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      player_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      points: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      games_played: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      wins: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      losses: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      win_rate: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0.00
      },
      season: {
        type: Sequelize.STRING,
        allowNull: false
      },
      position: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      history: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    await queryInterface.addIndex('rankings', ['player_id']);
    await queryInterface.addIndex('rankings', ['points']);
    await queryInterface.addIndex('rankings', ['season']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('rankings');
  }
};
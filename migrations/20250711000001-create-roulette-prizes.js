'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('roulette_prizes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      prize_type: {
        type: Sequelize.ENUM(
          'tournament_ticket',
          'deposit_bonus',
          'rakeback',
          'cash_game_money',
          'merchandise'
        ),
        allowNull: false
      },
      prize_value: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00
      },
      prize_metadata: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      probability: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        validate: {
          min: 0,
          max: 100
        }
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      color: {
        type: Sequelize.STRING(7),
        defaultValue: '#000000'
      },
      position: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true
      },
      min_deposit_required: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Índices
    await queryInterface.addIndex('roulette_prizes', ['is_active']);
    await queryInterface.addIndex('roulette_prizes', ['position']);
    await queryInterface.addIndex('roulette_prizes', ['prize_type']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('roulette_prizes');
  }
};
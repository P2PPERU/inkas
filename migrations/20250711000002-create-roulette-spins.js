'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('roulette_spins', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      prize_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'roulette_prizes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      spin_type: {
        type: Sequelize.ENUM('demo', 'welcome_real', 'code', 'bonus'),
        allowNull: false
      },
      is_real_prize: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      code_used: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      spin_date: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      prize_status: {
        type: Sequelize.ENUM('pending_validation', 'applied', 'rejected', 'demo'),
        defaultValue: 'demo'
      },
      validated_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      validated_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      prize_expiry_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Índices
    await queryInterface.addIndex('roulette_spins', ['user_id']);
    await queryInterface.addIndex('roulette_spins', ['prize_id']);
    await queryInterface.addIndex('roulette_spins', ['spin_type']);
    await queryInterface.addIndex('roulette_spins', ['prize_status']);
    await queryInterface.addIndex('roulette_spins', ['spin_date']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('roulette_spins');
  }
};
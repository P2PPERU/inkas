'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('bonuses', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      type: {
        type: Sequelize.ENUM('welcome', 'deposit', 'referral', 'achievement', 'custom'),
        allowNull: false
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      percentage: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      min_deposit: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00
      },
      max_bonus: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      assigned_to: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      assigned_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      status: {
        type: Sequelize.ENUM('pending', 'active', 'claimed', 'expired'),
        defaultValue: 'pending'
      },
      valid_from: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      valid_until: {
        type: Sequelize.DATE,
        allowNull: true
      },
      claimed_at: {
        type: Sequelize.DATE,
        allowNull: true
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

    await queryInterface.addIndex('bonuses', ['assigned_to']);
    await queryInterface.addIndex('bonuses', ['assigned_by']);
    await queryInterface.addIndex('bonuses', ['status']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('bonuses');
  }
};
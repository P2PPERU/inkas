'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('affiliate_codes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      affiliate_profile_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'affiliate_profiles',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      code: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true
      },
      bonus_amount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00
      },
      usage_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      max_uses: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      expires_at: {
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

    await queryInterface.addIndex('affiliate_codes', ['code']);
    await queryInterface.addIndex('affiliate_codes', ['affiliate_profile_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('affiliate_codes');
  }
};
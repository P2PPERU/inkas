'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('affiliate_profiles', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      user_id: {
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
      affiliate_code: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true
      },
      commission_rate: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 10.00
      },
      total_referrals: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      total_earnings: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      custom_url: {
        type: Sequelize.STRING,
        allowNull: true
      },
      marketing_materials: {
        type: Sequelize.JSONB,
        defaultValue: {}
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

    await queryInterface.addIndex('affiliate_profiles', ['affiliate_code']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('affiliate_profiles');
  }
};
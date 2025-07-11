module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('roulette_codes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      code: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true
      },
      prize_type: {
        type: Sequelize.ENUM('bonus', 'points', 'free_spin', 'discount'),
        allowNull: false
      },
      prize_value: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      prize_description: {
        type: Sequelize.STRING,
        allowNull: true
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      used_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      used_at: {
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

    await queryInterface.addIndex('roulette_codes', ['code']);
    await queryInterface.addIndex('roulette_codes', ['created_by']);
    await queryInterface.addIndex('roulette_codes', ['used_by']);
    await queryInterface.addIndex('roulette_codes', ['is_active']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('roulette_codes');
  }
};
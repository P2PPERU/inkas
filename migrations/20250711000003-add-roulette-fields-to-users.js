'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Agregar campos para el sistema de ruleta
    await queryInterface.addColumn('users', 'first_spin_demo_used', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });

    await queryInterface.addColumn('users', 'real_spin_available', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });

    await queryInterface.addColumn('users', 'validated_for_spin', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });

    await queryInterface.addColumn('users', 'spin_validated_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addColumn('users', 'spin_validated_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    // Crear índices para mejorar performance
    await queryInterface.addIndex('users', ['validated_for_spin']);
    await queryInterface.addIndex('users', ['real_spin_available']);
  },

  down: async (queryInterface, Sequelize) => {
    // Eliminar índices
    await queryInterface.removeIndex('users', ['validated_for_spin']);
    await queryInterface.removeIndex('users', ['real_spin_available']);

    // Eliminar columnas
    await queryInterface.removeColumn('users', 'first_spin_demo_used');
    await queryInterface.removeColumn('users', 'real_spin_available');
    await queryInterface.removeColumn('users', 'validated_for_spin');
    await queryInterface.removeColumn('users', 'spin_validated_by');
    await queryInterface.removeColumn('users', 'spin_validated_at');
  }
};
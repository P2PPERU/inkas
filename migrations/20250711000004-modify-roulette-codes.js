'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Eliminar columnas antiguas relacionadas con premios directos
    await queryInterface.removeColumn('roulette_codes', 'prize_type');
    await queryInterface.removeColumn('roulette_codes', 'prize_value');
    await queryInterface.removeColumn('roulette_codes', 'prize_description');

    // Agregar nueva columna para indicar que otorga un giro
    await queryInterface.addColumn('roulette_codes', 'grants_spin', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false
    });

    // Agregar columna para descripción del código
    await queryInterface.addColumn('roulette_codes', 'description', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Restaurar columnas antiguas
    await queryInterface.addColumn('roulette_codes', 'prize_type', {
      type: Sequelize.ENUM('bonus', 'points', 'free_spin', 'discount'),
      allowNull: true
    });

    await queryInterface.addColumn('roulette_codes', 'prize_value', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true
    });

    await queryInterface.addColumn('roulette_codes', 'prize_description', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // Eliminar nuevas columnas
    await queryInterface.removeColumn('roulette_codes', 'grants_spin');
    await queryInterface.removeColumn('roulette_codes', 'description');
  }
};
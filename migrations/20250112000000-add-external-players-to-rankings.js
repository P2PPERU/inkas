'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Hacer player_id opcional
    await queryInterface.changeColumn('rankings', 'player_id', {
      type: Sequelize.UUID,
      allowNull: true,  // CAMBIO IMPORTANTE
      references: {
        model: 'users',
        key: 'id'
      }
    });
    
    // 2. Agregar columnas para jugadores externos
    await queryInterface.addColumn('rankings', 'external_player_name', {
      type: Sequelize.STRING(100),
      allowNull: true
    });
    
    await queryInterface.addColumn('rankings', 'external_player_email', {
      type: Sequelize.STRING(100),
      allowNull: true
    });
    
    await queryInterface.addColumn('rankings', 'is_external', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });

    // 3. Agregar índice para jugadores externos
    await queryInterface.addIndex('rankings', ['external_player_name'], {
      name: 'rankings_external_player_name_idx'
    });

    console.log('✅ Migración completada: Rankings ahora soporta jugadores externos');
  },
  
  down: async (queryInterface, Sequelize) => {
    // Revertir cambios
    await queryInterface.removeIndex('rankings', 'rankings_external_player_name_idx');
    await queryInterface.removeColumn('rankings', 'is_external');
    await queryInterface.removeColumn('rankings', 'external_player_email');
    await queryInterface.removeColumn('rankings', 'external_player_name');
    
    // Volver a hacer player_id requerido
    await queryInterface.changeColumn('rankings', 'player_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    });
  }
};
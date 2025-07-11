'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Cambiar prize_type de ENUM a STRING para mayor flexibilidad
    await queryInterface.changeColumn('roulette_prizes', 'prize_type', {
      type: Sequelize.STRING(50),
      allowNull: false
    });

    // 2. Agregar campo para comportamiento del premio
    await queryInterface.addColumn('roulette_prizes', 'prize_behavior', {
      type: Sequelize.ENUM(
        'instant_cash',      // Dinero directo al balance
        'bonus',             // Crear bonus
        'manual',            // Procesamiento manual
        'custom'             // Comportamiento personalizado
      ),
      defaultValue: 'manual',
      allowNull: false
    });

    // 3. Agregar campo para configuración personalizada
    await queryInterface.addColumn('roulette_prizes', 'custom_config', {
      type: Sequelize.JSONB,
      defaultValue: {},
      allowNull: true
    });

    // 4. Actualizar registros existentes con el comportamiento apropiado
    await queryInterface.sequelize.query(`
      UPDATE roulette_prizes 
      SET prize_behavior = CASE
        WHEN prize_type = 'cash_game_money' THEN 'instant_cash'
        WHEN prize_type IN ('deposit_bonus', 'tournament_ticket') THEN 'bonus'
        ELSE 'manual'
      END
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Revertir cambios
    await queryInterface.removeColumn('roulette_prizes', 'custom_config');
    await queryInterface.removeColumn('roulette_prizes', 'prize_behavior');
    
    // Restaurar ENUM original
    await queryInterface.changeColumn('roulette_prizes', 'prize_type', {
      type: Sequelize.ENUM(
        'tournament_ticket',
        'deposit_bonus',
        'rakeback',
        'cash_game_money',
        'merchandise'
      ),
      allowNull: false
    });
  }
};
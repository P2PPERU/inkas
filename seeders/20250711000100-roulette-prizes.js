'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Obtener el ID del admin
    const adminUser = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE username = 'admin' LIMIT 1`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (adminUser.length === 0) {
      console.log('⚠️ No se encontró usuario admin. Ejecuta primero el seeder de usuarios.');
      return;
    }

    const adminId = adminUser[0].id;

    // Configuración de premios inicial
    const prizes = [
      {
        id: uuidv4(),
        name: 'Ticket Torneo Semanal $20',
        description: 'Entrada gratuita al torneo semanal con premio de $20',
        prize_type: 'tournament_ticket',
        prize_value: 20.00,
        prize_metadata: JSON.stringify({
          tournament_id: 'weekly-tournament-20',
          tournament_name: 'Torneo Semanal $20'
        }),
        probability: 20.00,
        is_active: true,
        color: '#FF6B6B',
        position: 1,
        min_deposit_required: 0.00,
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: 'Bono 50% Próximo Depósito',
        description: 'Recibe 50% extra en tu próximo depósito (máximo $100)',
        prize_type: 'deposit_bonus',
        prize_value: 100.00,
        prize_metadata: JSON.stringify({
          bonus_percentage: 50,
          max_bonus: 100,
          min_deposit: 20
        }),
        probability: 15.00,
        is_active: true,
        color: '#4ECDC4',
        position: 2,
        min_deposit_required: 20.00,
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: '$10 Cash Game',
        description: '$10 directos para jugar en mesas cash',
        prize_type: 'cash_game_money',
        prize_value: 10.00,
        prize_metadata: JSON.stringify({}),
        probability: 15.00,
        is_active: true,
        color: '#45B7D1',
        position: 3,
        min_deposit_required: 0.00,
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: 'Rakeback 10% x 3 días',
        description: 'Recupera el 10% del rake durante 3 días',
        prize_type: 'rakeback',
        prize_value: 0.00,
        prize_metadata: JSON.stringify({
          rakeback_percentage: 10,
          rakeback_days: 3
        }),
        probability: 15.00,
        is_active: true,
        color: '#96CEB4',
        position: 4,
        min_deposit_required: 0.00,
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: '$5 Cash Game',
        description: '$5 directos para jugar',
        prize_type: 'cash_game_money',
        prize_value: 5.00,
        prize_metadata: JSON.stringify({}),
        probability: 10.00,
        is_active: true,
        color: '#FFEAA7',
        position: 5,
        min_deposit_required: 0.00,
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: 'Gorra Poker Club',
        description: 'Gorra oficial del club',
        prize_type: 'merchandise',
        prize_value: 0.00,
        prize_metadata: JSON.stringify({
          item_code: 'CAP-001',
          item_name: 'Gorra Oficial Poker Club',
          requires_shipping: true
        }),
        probability: 5.00,
        is_active: true,
        color: '#DDA0DD',
        position: 6,
        min_deposit_required: 0.00,
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: 'Sigue Intentando',
        description: 'No ganaste esta vez, ¡pero sigue participando!',
        prize_type: 'cash_game_money',
        prize_value: 0.00,
        prize_metadata: JSON.stringify({}),
        probability: 20.00,
        is_active: true,
        color: '#636E72',
        position: 7,
        min_deposit_required: 0.00,
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    // Verificar que las probabilidades suman 100%
    const totalProbability = prizes.reduce((sum, prize) => sum + prize.probability, 0);
    console.log(`✅ Probabilidad total: ${totalProbability}%`);

    if (Math.abs(totalProbability - 100) > 0.01) {
      console.error('❌ Error: Las probabilidades no suman 100%');
      return;
    }

    // Insertar premios
    await queryInterface.bulkInsert('roulette_prizes', prizes, {});

    console.log('✅ Premios de ruleta creados:');
    prizes.forEach(prize => {
      console.log(`   - ${prize.name} (${prize.probability}%)`);
    });

    // Crear algunos códigos de ejemplo
    const codes = [];
    for (let i = 1; i <= 5; i++) {
      codes.push({
        id: uuidv4(),
        code: `SPIN${2024 + i}`,
        grants_spin: true,
        description: `Código promocional ${i} - Giro gratis`,
        created_by: adminId,
        is_active: true,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
        created_at: new Date(),
        updated_at: new Date()
      });
    }

    await queryInterface.bulkInsert('roulette_codes', codes, {});

    console.log('✅ Códigos de ruleta creados:');
    codes.forEach(code => {
      console.log(`   - ${code.code}`);
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Eliminar códigos
    await queryInterface.bulkDelete('roulette_codes', {
      code: { 
        [Sequelize.Op.in]: ['SPIN2025', 'SPIN2026', 'SPIN2027', 'SPIN2028', 'SPIN2029']
      }
    }, {});

    // Eliminar premios
    await queryInterface.bulkDelete('roulette_prizes', null, {});
  }
};
'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Obtener los IDs de los perfiles de afiliado
    const affiliateProfiles = await queryInterface.sequelize.query(
      `SELECT id, user_id FROM affiliate_profiles WHERE affiliate_code IN ('INKAS2024', 'INKAS2025', 'INKAS2026')`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (affiliateProfiles.length === 0) {
      console.log('⚠️ No se encontraron perfiles de afiliado. Ejecuta primero el seeder de agentes.');
      return;
    }

    // Crear códigos adicionales para cada afiliado
    const codes = [];
    
    affiliateProfiles.forEach((profile, index) => {
      // Código de bienvenida
      codes.push({
        id: uuidv4(),
        affiliate_profile_id: profile.id,
        code: `WELCOME${index + 1}`,
        description: 'Bono de bienvenida 50%',
        bonus_amount: 50.00,
        usage_count: 0,
        max_uses: 100,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      });

      // Código especial
      codes.push({
        id: uuidv4(),
        affiliate_profile_id: profile.id,
        code: `SPECIAL${index + 1}`,
        description: 'Bono especial 100',
        bonus_amount: 100.00,
        usage_count: 0,
        max_uses: 50,
        is_active: true,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
        created_at: new Date(),
        updated_at: new Date()
      });
    });

    await queryInterface.bulkInsert('affiliate_codes', codes, {});

    console.log('✅ Códigos de afiliación creados:');
    console.log('   WELCOME1, WELCOME2, WELCOME3 - Bono 50');
    console.log('   SPECIAL1, SPECIAL2, SPECIAL3 - Bono 100 (30 días)');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('affiliate_codes', {
      code: { 
        [Sequelize.Op.in]: [
          'WELCOME1', 'WELCOME2', 'WELCOME3',
          'SPECIAL1', 'SPECIAL2', 'SPECIAL3'
        ] 
      }
    }, {});
  }
};
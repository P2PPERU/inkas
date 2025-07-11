'use strict';
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Crear un editor
    const editorId = uuidv4();
    const editorPassword = await bcrypt.hash('editor123', 10);
    
    await queryInterface.bulkInsert('users', [{
      id: editorId,
      username: 'editor1',
      email: 'editor@inkaspoker.com',
      password: editorPassword,
      role: 'editor',
      balance: 0,
      profile_data: JSON.stringify({
        firstName: 'Ana',
        lastName: 'Editor',
        phone: '+51900000001',
        avatar: null
      }),
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }], {});

    // 2. Crear algunas noticias de ejemplo
    const newsData = [
      {
        id: uuidv4(),
        title: 'Gran Torneo de Poker Inkas 2024',
        content: 'Prepárate para el evento más grande del año. El Gran Torneo de Poker Inkas 2024 contará con premios increíbles y la participación de los mejores jugadores del país.',
        summary: 'El torneo más esperado del año está por comenzar',
        category: 'tournament',
        author_id: editorId,
        status: 'published',
        published_at: new Date(),
        views: 150,
        tags: ['torneo', 'poker', '2024'],
        featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        title: 'Nuevas Promociones Especiales',
        content: 'Este mes tenemos promociones exclusivas para todos nuestros jugadores. Bonos de depósito, giros gratis y mucho más.',
        summary: 'Aprovecha las mejores promociones del mes',
        category: 'promotion',
        author_id: editorId,
        status: 'published',
        published_at: new Date(),
        views: 89,
        tags: ['promociones', 'bonos'],
        featured: false,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('news', newsData, {});

    // 3. Crear algunos clientes de prueba
    const agent1 = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE username = 'agent1'`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (agent1.length > 0) {
      const clientPassword = await bcrypt.hash('cliente123', 10);
      const clientsData = [];
      const rankingsData = [];
      
      for (let i = 1; i <= 3; i++) {
        const clientId = uuidv4();
        
        // Primero agregamos el cliente al array
        clientsData.push({
          id: clientId,
          username: `cliente${i}`,
          email: `cliente${i}@example.com`,
          password: clientPassword,
          role: 'client',
          balance: 100.00 * i,
          parent_agent_id: agent1[0].id,
          profile_data: JSON.stringify({
            firstName: `Cliente${i}`,
            lastName: 'Demo',
            phone: `+5190000000${i}`,
            avatar: null
          }),
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        });

        // Agregamos el ranking al array (para insertar después)
        rankingsData.push({
          id: uuidv4(),
          player_id: clientId, // Usamos el mismo ID del cliente
          points: 100 * i,
          games_played: 10 * i,
          wins: 6 * i,
          losses: 4 * i,
          win_rate: 60.00,
          season: '2024-01',
          position: i,
          history: JSON.stringify([]),
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      // Primero insertamos TODOS los clientes
      await queryInterface.bulkInsert('users', clientsData, {});
      
      // DESPUÉS insertamos los rankings
      await queryInterface.bulkInsert('rankings', rankingsData, {});
    }

    // 4. Crear códigos de ruleta de ejemplo
    const adminUser = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE username = 'admin'`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (adminUser.length > 0) {
      const rouletteCodes = [
        {
          id: uuidv4(),
          code: 'SPIN2024',
          prize_type: 'bonus',
          prize_value: 25.00,
          prize_description: 'Bono de 25 créditos',
          created_by: adminUser[0].id,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: uuidv4(),
          code: 'LUCKY777',
          prize_type: 'points',
          prize_value: 500.00,
          prize_description: '500 puntos para ranking',
          created_by: adminUser[0].id,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      await queryInterface.bulkInsert('roulette_codes', rouletteCodes, {});
    }

    console.log('✅ Datos demo creados:');
    console.log('   Editor: editor@inkaspoker.com - Password: editor123');
    console.log('   Clientes: cliente1, cliente2, cliente3 - Password: cliente123');
    console.log('   Noticias: 2 publicadas');
    console.log('   Códigos ruleta: SPIN2024, LUCKY777');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('roulette_codes', {
      code: { [Sequelize.Op.in]: ['SPIN2024', 'LUCKY777'] }
    }, {});
    
    await queryInterface.bulkDelete('rankings', null, {});
    
    await queryInterface.bulkDelete('news', {
      author_id: { [Sequelize.Op.ne]: null }
    }, {});
    
    await queryInterface.bulkDelete('users', {
      username: { 
        [Sequelize.Op.in]: ['editor1', 'cliente1', 'cliente2', 'cliente3'] 
      }
    }, {});
  }
};
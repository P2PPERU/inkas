'use strict';
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const hashedPassword = await bcrypt.hash('agent123', 10);
    
    // Crear 3 agentes de ejemplo
    const agents = [
      {
        id: uuidv4(),
        username: 'agent1',
        email: 'agent1@inkaspoker.com',
        firstName: 'Carlos',
        lastName: 'Rodriguez'
      },
      {
        id: uuidv4(),
        username: 'agent2',
        email: 'agent2@inkaspoker.com',
        firstName: 'Maria',
        lastName: 'Gonzalez'
      },
      {
        id: uuidv4(),
        username: 'agent3',
        email: 'agent3@inkaspoker.com',
        firstName: 'Juan',
        lastName: 'Perez'
      }
    ];

    // Insertar usuarios agentes
    const agentUsers = agents.map(agent => ({
      id: agent.id,
      username: agent.username,
      email: agent.email,
      password: hashedPassword,
      role: 'agent',
      balance: 0,
      profile_data: JSON.stringify({
        firstName: agent.firstName,
        lastName: agent.lastName,
        phone: '+51900000000',
        avatar: null
      }),
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }));

    await queryInterface.bulkInsert('users', agentUsers, {});

    // Crear perfiles de afiliado para cada agente
    const affiliateProfiles = agents.map((agent, index) => ({
      id: uuidv4(),
      user_id: agent.id,
      affiliate_code: `INKAS${2024 + index}`,
      commission_rate: 10.00,
      total_referrals: 0,
      total_earnings: 0,
      is_active: true,
      custom_url: `https://inkaspoker.com/ref/${agent.username}`,
      marketing_materials: JSON.stringify({
        banners: [],
        links: []
      }),
      created_at: new Date(),
      updated_at: new Date()
    }));

    await queryInterface.bulkInsert('affiliate_profiles', affiliateProfiles, {});

    console.log('✅ 3 agentes creados con sus perfiles de afiliado');
    console.log('   Emails: agent1@inkaspoker.com, agent2@inkaspoker.com, agent3@inkaspoker.com');
    console.log('   Password: agent123');
    console.log('   Códigos: INKAS2024, INKAS2025, INKAS2026');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('affiliate_profiles', {
      affiliate_code: { [Sequelize.Op.in]: ['INKAS2024', 'INKAS2025', 'INKAS2026'] }
    }, {});
    
    await queryInterface.bulkDelete('users', {
      email: { [Sequelize.Op.in]: ['agent1@inkaspoker.com', 'agent2@inkaspoker.com', 'agent3@inkaspoker.com'] }
    }, {});
  }
};
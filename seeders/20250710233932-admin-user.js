'use strict';
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const adminId = uuidv4();
    const hashedPassword = await bcrypt.hash('admin123', 10);

    await queryInterface.bulkInsert('users', [{
      id: adminId,
      username: 'admin',
      email: 'admin@inkaspoker.com',
      password: hashedPassword,
      role: 'admin',
      balance: 0,
      profile_data: JSON.stringify({
        firstName: 'Super',
        lastName: 'Admin',
        phone: '+51999999999',
        avatar: null
      }),
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }], {});

    console.log('✅ Usuario admin creado - Email: admin@inkaspoker.com - Password: admin123');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('users', { 
      email: 'admin@inkaspoker.com' 
    }, {});
  }
};
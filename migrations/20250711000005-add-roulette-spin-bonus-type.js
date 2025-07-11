'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // PostgreSQL requiere eliminar y recrear el ENUM para agregar valores
    // Primero renombramos el tipo antiguo
    await queryInterface.sequelize.query(
      'ALTER TYPE "enum_bonuses_type" RENAME TO "enum_bonuses_type_old"'
    );

    // Crear el nuevo tipo con el valor adicional
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_bonuses_type" AS ENUM (
        'welcome',
        'deposit',
        'referral',
        'achievement',
        'custom',
        'roulette_spin'
      )
    `);

    // Cambiar la columna para usar el nuevo tipo
    await queryInterface.sequelize.query(`
      ALTER TABLE "bonuses" 
      ALTER COLUMN "type" TYPE "enum_bonuses_type" 
      USING "type"::text::"enum_bonuses_type"
    `);

    // Eliminar el tipo antiguo
    await queryInterface.sequelize.query(
      'DROP TYPE "enum_bonuses_type_old"'
    );
  },

  down: async (queryInterface, Sequelize) => {
    // Revertir el proceso
    await queryInterface.sequelize.query(
      'ALTER TYPE "enum_bonuses_type" RENAME TO "enum_bonuses_type_old"'
    );

    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_bonuses_type" AS ENUM (
        'welcome',
        'deposit',
        'referral',
        'achievement',
        'custom'
      )
    `);

    // Convertir cualquier 'roulette_spin' a 'custom' antes de cambiar
    await queryInterface.sequelize.query(`
      UPDATE "bonuses" 
      SET "type" = 'custom' 
      WHERE "type" = 'roulette_spin'
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "bonuses" 
      ALTER COLUMN "type" TYPE "enum_bonuses_type" 
      USING "type"::text::"enum_bonuses_type"
    `);

    await queryInterface.sequelize.query(
      'DROP TYPE "enum_bonuses_type_old"'
    );
  }
};
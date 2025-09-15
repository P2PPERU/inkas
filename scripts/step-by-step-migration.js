// scripts/step-by-step-migration.js
const { sequelize } = require('../src/models');

async function stepByStepMigration() {
  try {
    console.log('🚀 Iniciando migración paso a paso...');

    // Paso 1: Sincronizar solo las nuevas tablas
    console.log('📊 Paso 1: Creando tabla ranking_groups...');
    await sequelize.getQueryInterface().createTable('ranking_groups', {
      id: {
        type: sequelize.Sequelize.DataTypes.UUID,
        defaultValue: sequelize.Sequelize.DataTypes.UUIDV4,
        primaryKey: true
      },
      name: {
        type: sequelize.Sequelize.DataTypes.STRING(100),
        allowNull: false,
        unique: true
      },
      description: {
        type: sequelize.Sequelize.DataTypes.TEXT,
        allowNull: true
      },
      ranking_type: {
        type: sequelize.Sequelize.DataTypes.ENUM('points', 'hands_played', 'tournaments', 'rake'),
        allowNull: false
      },
      start_date: {
        type: sequelize.Sequelize.DataTypes.DATE,
        allowNull: false
      },
      end_date: {
        type: sequelize.Sequelize.DataTypes.DATE,
        allowNull: false
      },
      is_active: {
        type: sequelize.Sequelize.DataTypes.BOOLEAN,
        defaultValue: true
      },
      is_visible: {
        type: sequelize.Sequelize.DataTypes.BOOLEAN,
        defaultValue: true
      },
      settings: {
        type: sequelize.Sequelize.DataTypes.JSONB,
        defaultValue: {}
      },
      created_by: {
        type: sequelize.Sequelize.DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      last_updated_by: {
        type: sequelize.Sequelize.DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      created_at: {
        type: sequelize.Sequelize.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: sequelize.Sequelize.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      },
      deleted_at: {
        type: sequelize.Sequelize.DataTypes.DATE,
        allowNull: true
      }
    });

    console.log('✅ Tabla ranking_groups creada');

    // Paso 2: Agregar la columna ranking_group_id como NULLABLE
    console.log('📊 Paso 2: Agregando columna ranking_group_id (nullable)...');
    
    try {
      await sequelize.getQueryInterface().addColumn('rankings', 'ranking_group_id', {
        type: sequelize.Sequelize.DataTypes.UUID,
        allowNull: true, // IMPORTANTE: Primero como nullable
        references: {
          model: 'ranking_groups',
          key: 'id'
        }
      });
      console.log('✅ Columna ranking_group_id agregada');
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('ya existe')) {
        console.log('⚠️  Columna ranking_group_id ya existe, continuando...');
      } else {
        throw error;
      }
    }

    console.log('🎉 Migración de estructura completada!');
    console.log('');
    console.log('📋 Próximos pasos:');
    console.log('1. Reinicia el servidor: npm run dev');
    console.log('2. Ejecuta la migración de datos: node scripts/migrate-ranking-data.js');
    
    return {
      success: true,
      message: 'Estructura migrada exitosamente'
    };

  } catch (error) {
    console.error('❌ Error durante la migración de estructura:', error);
    throw error;
  }
}

// Función para crear grupos automáticamente basados en datos existentes
async function migrateRankingData() {
  const t = await sequelize.transaction();
  
  try {
    console.log('🚀 Iniciando migración de datos...');

    // Importar modelos después de que la estructura esté lista
    const { RankingGroup, Ranking } = require('../src/models');

    // 1. Obtener todos los rankings existentes agrupados por tipo y temporada
    const existingRankings = await sequelize.query(`
      SELECT 
        ranking_type,
        season, 
        ranking_period,
        COUNT(*) as count,
        MIN(created_at) as earliest_date,
        MAX(updated_at) as latest_date
      FROM rankings 
      WHERE ranking_group_id IS NULL
      GROUP BY ranking_type, season, ranking_period
      ORDER BY latest_date DESC
    `, { 
      type: sequelize.QueryTypes.SELECT,
      transaction: t 
    });

    console.log(`📊 Encontrados ${existingRankings.length} grupos únicos de rankings`);

    if (existingRankings.length === 0) {
      console.log('✅ No hay rankings que migrar');
      await t.commit();
      return { success: true, message: 'No hay datos que migrar' };
    }

    // 2. Buscar un usuario admin para asignar como creador
    const adminUser = await sequelize.query(`
      SELECT id FROM users WHERE role = 'admin' LIMIT 1
    `, { 
      type: sequelize.QueryTypes.SELECT,
      transaction: t 
    });

    const createdBy = adminUser.length > 0 ? adminUser[0].id : null;

    if (!createdBy) {
      throw new Error('No se encontró un usuario admin para asignar como creador de grupos');
    }

    // 3. Crear grupos automáticamente
    const createdGroups = [];
    
    for (const ranking of existingRankings) {
      const groupName = `${ranking.ranking_type.charAt(0).toUpperCase() + ranking.ranking_type.slice(1)} Ranking - ${ranking.season} (${ranking.ranking_period})`;
      
      // Calcular fechas basadas en la temporada
      const [year, month] = ranking.season.split('-');
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

      try {
        const [group, created] = await RankingGroup.findOrCreate({
          where: { name: groupName },
          defaults: {
            name: groupName,
            description: `Ranking automáticamente migrado del sistema anterior. Tipo: ${ranking.ranking_type}, Temporada: ${ranking.season}, Período: ${ranking.ranking_period}`,
            ranking_type: ranking.ranking_type,
            start_date: startDate,
            end_date: endDate,
            is_active: new Date() >= startDate && new Date() <= endDate,
            is_visible: true,
            settings: {
              migrated: true,
              original_season: ranking.season,
              original_period: ranking.ranking_period,
              player_count: parseInt(ranking.count)
            },
            created_by: createdBy
          },
          transaction: t
        });

        createdGroups.push({
          group,
          original: ranking,
          created
        });

        if (created) {
          console.log(`✅ Creado grupo: ${groupName} (${ranking.count} rankings)`);
        } else {
          console.log(`⚠️  Grupo existente: ${groupName}`);
        }
      } catch (error) {
        console.error(`❌ Error creando grupo ${groupName}:`, error.message);
      }
    }

    // 4. Actualizar rankings existentes
    console.log('🔄 Asociando rankings existentes con sus grupos...');
    
    for (const { group, original } of createdGroups) {
      const [updatedCount] = await sequelize.query(`
        UPDATE rankings 
        SET ranking_group_id = :groupId 
        WHERE ranking_type = :rankingType 
          AND season = :season 
          AND ranking_period = :period 
          AND ranking_group_id IS NULL
      `, {
        replacements: {
          groupId: group.id,
          rankingType: original.ranking_type,
          season: original.season,
          period: original.ranking_period
        },
        type: sequelize.QueryTypes.UPDATE,
        transaction: t
      });

      console.log(`✅ Asociados ${updatedCount} rankings al grupo: ${group.name}`);
    }

    await t.commit();

    console.log('🎉 Migración de datos completada exitosamente!');
    console.log(`📈 Resumen:`);
    console.log(`   - ${createdGroups.length} grupos de rankings creados/utilizados`);
    console.log(`   - Todos los rankings existentes han sido asociados a sus grupos`);
    
    return {
      success: true,
      groupsProcessed: createdGroups.length,
      message: 'Migración de datos completada exitosamente'
    };

  } catch (error) {
    await t.rollback();
    console.error('❌ Error durante la migración de datos:', error);
    throw error;
  }
}

// Verificar estado de migración
async function checkMigrationStatus() {
  try {
    // Verificar si existe la tabla ranking_groups
    const tablesResult = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = 'ranking_groups'
    `, { type: sequelize.QueryTypes.SELECT });

    const rankingGroupsExists = tablesResult.length > 0;

    // Verificar si existe la columna ranking_group_id
    const columnsResult = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'rankings' 
        AND column_name = 'ranking_group_id'
    `, { type: sequelize.QueryTypes.SELECT });

    const columnExists = columnsResult.length > 0;

    let dataStatus = null;
    if (rankingGroupsExists && columnExists) {
      const [totalRankings] = await sequelize.query(`
        SELECT COUNT(*) as total FROM rankings
      `, { type: sequelize.QueryTypes.SELECT });

      const [rankingsWithGroup] = await sequelize.query(`
        SELECT COUNT(*) as total FROM rankings WHERE ranking_group_id IS NOT NULL
      `, { type: sequelize.QueryTypes.SELECT });

      const [totalGroups] = await sequelize.query(`
        SELECT COUNT(*) as total FROM ranking_groups
      `, { type: sequelize.QueryTypes.SELECT });

      dataStatus = {
        totalRankings: parseInt(totalRankings.total),
        rankingsWithGroup: parseInt(rankingsWithGroup.total),
        rankingsWithoutGroup: parseInt(totalRankings.total) - parseInt(rankingsWithGroup.total),
        totalGroups: parseInt(totalGroups.total)
      };
    }

    console.log('📊 Estado de la migración:');
    console.log(`   - Tabla ranking_groups: ${rankingGroupsExists ? '✅ Existe' : '❌ No existe'}`);
    console.log(`   - Columna ranking_group_id: ${columnExists ? '✅ Existe' : '❌ No existe'}`);
    
    if (dataStatus) {
      console.log(`   - Total de rankings: ${dataStatus.totalRankings}`);
      console.log(`   - Rankings con grupo: ${dataStatus.rankingsWithGroup}`);
      console.log(`   - Rankings sin grupo: ${dataStatus.rankingsWithoutGroup}`);
      console.log(`   - Total de grupos: ${dataStatus.totalGroups}`);
      console.log(`   - Migración completa: ${dataStatus.rankingsWithoutGroup === 0 ? '✅ SÍ' : '❌ NO'}`);
    }

    return {
      structureReady: rankingGroupsExists && columnExists,
      dataStatus,
      needsStructureMigration: !rankingGroupsExists || !columnExists,
      needsDataMigration: dataStatus ? dataStatus.rankingsWithoutGroup > 0 : false
    };
  } catch (error) {
    console.error('❌ Error al verificar estado:', error);
    throw error;
  }
}

// Ejecutar según argumento
if (require.main === module) {
  const action = process.argv[2];
  
  switch (action) {
    case 'structure':
      stepByStepMigration()
        .then(() => process.exit(0))
        .catch(error => {
          console.error(error);
          process.exit(1);
        });
      break;
      
    case 'data':
      migrateRankingData()
        .then(() => process.exit(0))
        .catch(error => {
          console.error(error);
          process.exit(1);
        });
      break;
      
    case 'status':
      checkMigrationStatus()
        .then(() => process.exit(0))
        .catch(error => {
          console.error(error);
          process.exit(1);
        });
      break;
      
    default:
      console.log('Uso: node step-by-step-migration.js [structure|data|status]');
      console.log('');
      console.log('Comandos:');
      console.log('  structure - Crear estructura de tablas');
      console.log('  data      - Migrar datos existentes');
      console.log('  status    - Verificar estado de migración');
      process.exit(1);
  }
}

module.exports = {
  stepByStepMigration,
  migrateRankingData,
  checkMigrationStatus
};
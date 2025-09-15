// src/models/Ranking.js - Versión final post-migración
const { Op } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const Ranking = sequelize.define('Ranking', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    ranking_group_id: {
        type: DataTypes.UUID,
        allowNull: false, // Ahora requerido
        references: {
            model: 'ranking_groups',
            key: 'id'
        }
    },
    player_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    external_player_name: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    external_player_email: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    is_external: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // Mantener campos legacy para compatibilidad durante transición
    ranking_type: {
        type: DataTypes.ENUM('points', 'hands_played', 'tournaments', 'rake', 'custom'),
        allowNull: true, // Opcional en el nuevo sistema
        defaultValue: 'points'
    },
    season: {
        type: DataTypes.STRING,
        allowNull: true // Opcional en el nuevo sistema
    },
    ranking_period: {
        type: DataTypes.STRING(20),
        allowNull: true, // Opcional en el nuevo sistema
        defaultValue: 'all_time'
    },
    points: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    games_played: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    hands_played: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    tournaments_played: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    total_rake: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00
    },
    wins: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    losses: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    win_rate: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0.00
    },
    position: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    is_visible: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
    },
    history: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    custom_data: {
        type: DataTypes.JSONB,
        defaultValue: {},
        allowNull: true
    },
    last_updated_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    last_import_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    import_filename: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'rankings',
    underscored: true,
    paranoid: true,
    hooks: {
        beforeSave: (ranking) => {
            if (ranking.games_played > 0) {
                ranking.win_rate = (ranking.wins / ranking.games_played * 100).toFixed(2);
            }
            if (ranking.changed()) {
                const historyEntry = {
                    date: new Date(),
                    points: ranking.points,
                    hands_played: ranking.hands_played,
                    tournaments_played: ranking.tournaments_played,
                    total_rake: ranking.total_rake,
                    position: ranking.position,
                    updated_by: ranking.last_updated_by
                };
                ranking.history = [...(ranking.history || []), historyEntry];
                if (ranking.history.length > 100) {
                    ranking.history = ranking.history.slice(-100);
                }
            }
        }
    },
    indexes: [
        {
            name: 'idx_ranking_group',
            fields: ['ranking_group_id']
        },
        {
            name: 'idx_player_id',
            fields: ['player_id']
        },
        {
            name: 'idx_external_player',
            fields: ['external_player_name']
        },
        {
            name: 'idx_legacy_ranking',
            fields: ['ranking_type', 'season', 'ranking_period']
        },
        {
            name: 'idx_ranking_group_player_unique',
            unique: true,
            fields: ['ranking_group_id', 'player_id']
        },
        {
            name: 'idx_ranking_group_external_unique',
            unique: true,
            fields: ['ranking_group_id', 'external_player_name', 'external_player_email']
        }
    ]
});

  Ranking.associate = (models) => {
    // Pertenece a un grupo de ranking
    Ranking.belongsTo(models.RankingGroup, {
      foreignKey: 'ranking_group_id',
      as: 'rankingGroup'
    });

    Ranking.belongsTo(models.User, {
      foreignKey: 'player_id',
      as: 'player',
      constraints: false
    });

    Ranking.belongsTo(models.User, {
      foreignKey: 'last_updated_by',
      as: 'updatedBy'
    });
  };

  // Métodos para el nuevo sistema con grupos
  Ranking.getRankingsByGroup = async function(groupId, options = {}) {
    const {
      limit = 100,
      includeInvisible = false
    } = options;

    const whereConditions = {
      ranking_group_id: groupId
    };

    if (!includeInvisible) {
      whereConditions.is_visible = true;
    }

    // Obtener el grupo para saber el tipo de ranking
    const group = await sequelize.models.RankingGroup.findByPk(groupId);
    if (!group) {
      throw new Error('Grupo de ranking no encontrado');
    }

    // Determinar campo de ordenamiento según el tipo
    let orderField = 'points';
    switch (group.ranking_type) {
      case 'hands_played':
        orderField = 'hands_played';
        break;
      case 'tournaments':
        orderField = 'tournaments_played';
        break;
      case 'rake':
        orderField = 'total_rake';
        break;
    }

    const rankings = await this.findAll({
      where: whereConditions,
      include: [
        {
          model: sequelize.models.User,
          as: 'player',
          attributes: ['id', 'username', 'profile_data'],
          required: false
        },
        {
          model: sequelize.models.RankingGroup,
          as: 'rankingGroup',
          attributes: ['id', 'name', 'ranking_type', 'start_date', 'end_date']
        }
      ],
      order: [[orderField, 'DESC']],
      limit
    });

    // Actualizar posiciones y nombres de display
    rankings.forEach((ranking, index) => {
      ranking.dataValues.position = index + 1;
      ranking.dataValues.displayName = ranking.player 
        ? ranking.player.username 
        : ranking.external_player_name;
    });

    return rankings;
  };

  Ranking.updatePositions = async function(groupId) {
    const rankings = await this.getRankingsByGroup(groupId, { 
      includeInvisible: true,
      limit: null 
    });

    const updates = rankings.map((ranking, index) => ({
      id: ranking.id,
      position: index + 1
    }));

    // Actualizar posiciones en batch
    for (const update of updates) {
      await this.update(
        { position: update.position },
        { where: { id: update.id } }
      );
    }

    return updates.length;
  };

  Ranking.createOrUpdateFromExcel = async function(data, updatedBy, groupId) {
    const results = {
      created: 0,
      updated: 0,
      errors: []
    };

    // Verificar que el grupo existe
    const group = await sequelize.models.RankingGroup.findByPk(groupId);
    if (!group) {
      throw new Error('Grupo de ranking no encontrado');
    }

    for (const row of data) {
      try {
        // Buscar usuario existente
        const user = await sequelize.models.User.findOne({
          where: {
            [Op.or]: [
              { username: row.username || row.usuario },
              { email: row.email }
            ]
          }
        });

        // Preparar datos base
        const playerIdentifier = row.username || row.usuario || row.email || 'Desconocido';
        const rankingData = {
          ranking_group_id: groupId,
          is_external: !user,
          player_id: user ? user.id : null,
          external_player_name: !user ? playerIdentifier : null,
          external_player_email: !user ? row.email : null
        };

        // Crear cláusula where según si es usuario externo o registrado
        const whereClause = user ? {
          player_id: user.id,
          ranking_group_id: groupId
        } : {
          external_player_name: rankingData.external_player_name,
          is_external: true,
          ranking_group_id: groupId
        };

        const [ranking, created] = await this.findOrCreate({
          where: whereClause,
          defaults: {
            ...rankingData,
            last_updated_by: updatedBy,
            last_import_date: new Date(),
            import_filename: row._filename
          }
        });

        // Actualizar valores según el tipo de ranking del grupo
        switch (group.ranking_type) {
          case 'points':
            if (row.puntos || row.points) {
              ranking.points = parseInt(row.puntos || row.points);
            }
            break;
          case 'hands_played':
            if (row.manos || row.hands_played) {
              ranking.hands_played = parseInt(row.manos || row.hands_played);
            }
            break;
          case 'tournaments':
            if (row.torneos || row.tournaments) {
              ranking.tournaments_played = parseInt(row.torneos || row.tournaments);
            }
            break;
          case 'rake':
            if (row.rake) {
              ranking.total_rake = parseFloat(row.rake);
            }
            break;
        }

        // Campos comunes
        if (row.wins) ranking.wins = parseInt(row.wins);
        if (row.losses) ranking.losses = parseInt(row.losses);
        if (row.games_played) ranking.games_played = parseInt(row.games_played);

        ranking.last_updated_by = updatedBy;
        ranking.last_import_date = new Date();
        ranking.import_filename = row._filename;

        await ranking.save();

        if (created) {
          results.created++;
        } else {
          results.updated++;
        }
      } catch (error) {
        results.errors.push({
          row,
          error: error.message
        });
      }
    }

    // Actualizar posiciones después de importar
    await this.updatePositions(groupId);

    return results;
  };

  // Métodos legacy para compatibilidad (TEMPORAL)
  Ranking.getRankingsByType = async function(type, options = {}) {
    const {
      season = null,
      period = 'all_time',
      limit = 100,
      includeInvisible = false
    } = options;

    // Buscar grupos que coincidan con los criterios legacy
    const groups = await sequelize.models.RankingGroup.findAll({
      where: {
        ranking_type: type,
        is_visible: includeInvisible ? undefined : true
      },
      include: [{
        model: this,
        as: 'rankings',
        where: {
          is_visible: includeInvisible ? undefined : true
        },
        include: [{
          model: sequelize.models.User,
          as: 'player',
          attributes: ['id', 'username', 'profile_data'],
          required: false
        }],
        required: false
      }]
    });

    // Aplanar rankings de todos los grupos
    const allRankings = groups.reduce((acc, group) => {
      return acc.concat(group.rankings || []);
    }, []);

    // Ordenar por el campo apropiado
    let orderField = 'points';
    switch (type) {
      case 'hands_played':
        orderField = 'hands_played';
        break;
      case 'tournaments':
        orderField = 'tournaments_played';
        break;
      case 'rake':
        orderField = 'total_rake';
        break;
    }

    allRankings.sort((a, b) => b[orderField] - a[orderField]);

    // Limitar resultados
    const limitedRankings = limit ? allRankings.slice(0, limit) : allRankings;

    // Actualizar posiciones y nombres de display
    limitedRankings.forEach((ranking, index) => {
      ranking.dataValues.position = index + 1;
      ranking.dataValues.displayName = ranking.player 
        ? ranking.player.username 
        : ranking.external_player_name;
    });

    return limitedRankings;
  };

  return Ranking;
};
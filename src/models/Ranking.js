module.exports = (sequelize, DataTypes) => {
  const Ranking = sequelize.define('Ranking', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    player_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    ranking_type: {
      type: DataTypes.ENUM('points', 'hands_played', 'tournaments', 'rake', 'custom'),
      allowNull: false,
      defaultValue: 'points'
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
    season: {
      type: DataTypes.STRING,
      defaultValue: () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }
    },
    ranking_period: {
      type: DataTypes.STRING(20),
      defaultValue: 'all_time', // all_time, monthly, weekly, daily
      allowNull: false
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
        // Calcular win rate si hay juegos
        if (ranking.games_played > 0) {
          ranking.win_rate = (ranking.wins / ranking.games_played * 100).toFixed(2);
        }
        
        // Agregar entrada al historial
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
          
          // Mantener solo los últimos 100 registros del historial
          if (ranking.history.length > 100) {
            ranking.history = ranking.history.slice(-100);
          }
        }
      }
    },
    indexes: [
      {
        unique: true,
        fields: ['player_id', 'ranking_type', 'season', 'ranking_period']
      }
    ]
  });

  Ranking.associate = (models) => {
    Ranking.belongsTo(models.User, {
      foreignKey: 'player_id',
      as: 'player'
    });

    Ranking.belongsTo(models.User, {
      foreignKey: 'last_updated_by',
      as: 'updatedBy'
    });
  };

  // Métodos estáticos
  Ranking.getRankingsByType = async function(type, options = {}) {
    const {
      season = null,
      period = 'all_time',
      limit = 100,
      includeInvisible = false
    } = options;

    const whereConditions = {
      ranking_type: type,
      ranking_period: period
    };

    if (!includeInvisible) {
      whereConditions.is_visible = true;
    }

    if (season) {
      whereConditions.season = season;
    }

    // Determinar campo de ordenamiento según el tipo
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

    const rankings = await this.findAll({
      where: whereConditions,
      include: [{
        model: sequelize.models.User,
        as: 'player',
        attributes: ['id', 'username', 'profile_data']
      }],
      order: [[orderField, 'DESC']],
      limit
    });

    // Actualizar posiciones
    rankings.forEach((ranking, index) => {
      ranking.position = index + 1;
    });

    return rankings;
  };

  Ranking.updatePositions = async function(type, season = null, period = 'all_time') {
    const rankings = await this.getRankingsByType(type, { 
      season, 
      period, 
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

  Ranking.createOrUpdateFromExcel = async function(data, updatedBy) {
    const results = {
      created: 0,
      updated: 0,
      errors: []
    };

    for (const row of data) {
      try {
        // Buscar usuario
        const user = await sequelize.models.User.findOne({
          where: {
            [DataTypes.Op.or]: [
              { username: row.username || row.usuario },
              { email: row.email }
            ]
          }
        });

        if (!user) {
          results.errors.push({
            row,
            error: 'Usuario no encontrado'
          });
          continue;
        }

        // Determinar tipo de ranking basado en los datos
        const rankingTypes = [];
        if (row.puntos || row.points) rankingTypes.push('points');
        if (row.manos || row.hands_played) rankingTypes.push('hands_played');
        if (row.torneos || row.tournaments) rankingTypes.push('tournaments');
        if (row.rake) rankingTypes.push('rake');

        for (const type of rankingTypes) {
          const [ranking, created] = await this.findOrCreate({
            where: {
              player_id: user.id,
              ranking_type: type,
              season: row.season || new Date().toISOString().slice(0, 7),
              ranking_period: row.period || 'all_time'
            },
            defaults: {
              last_updated_by: updatedBy,
              last_import_date: new Date(),
              import_filename: row._filename
            }
          });

          // Actualizar valores
          if (type === 'points' && (row.puntos || row.points)) {
            ranking.points = parseInt(row.puntos || row.points);
          }
          if (type === 'hands_played' && (row.manos || row.hands_played)) {
            ranking.hands_played = parseInt(row.manos || row.hands_played);
          }
          if (type === 'tournaments' && (row.torneos || row.tournaments)) {
            ranking.tournaments_played = parseInt(row.torneos || row.tournaments);
          }
          if (type === 'rake' && row.rake) {
            ranking.total_rake = parseFloat(row.rake);
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
        }
      } catch (error) {
        results.errors.push({
          row,
          error: error.message
        });
      }
    }

    // Actualizar posiciones después de importar
    const types = ['points', 'hands_played', 'tournaments', 'rake'];
    for (const type of types) {
      await this.updatePositions(type);
    }

    return results;
  };

  return Ranking;
};
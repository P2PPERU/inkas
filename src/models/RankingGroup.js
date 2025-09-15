// src/models/RankingGroup.js - Versión corregida
const { Op } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const RankingGroup = sequelize.define('RankingGroup', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    ranking_type: {
      type: DataTypes.ENUM('points', 'hands_played', 'tournaments', 'rake'),
      allowNull: false
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        isAfterStartDate(value) {
          if (value <= this.start_date) {
            throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
          }
        }
      }
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    is_visible: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    settings: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Configuraciones adicionales del ranking'
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    last_updated_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'ranking_groups',
    underscored: true,
    paranoid: true,
    hooks: {
      beforeValidate: (rankingGroup) => {
        // Asegurar que las fechas sean válidas
        if (rankingGroup.start_date && rankingGroup.end_date) {
          const start = new Date(rankingGroup.start_date);
          const end = new Date(rankingGroup.end_date);
          
          if (start >= end) {
            throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
          }
        }
      }
    },
    indexes: [
      {
        name: 'idx_ranking_group_name',
        unique: true,
        fields: ['name']
      },
      {
        name: 'idx_ranking_group_dates',
        fields: ['start_date', 'end_date']
      },
      {
        name: 'idx_ranking_group_type',
        fields: ['ranking_type']
      }
    ]
  });

  RankingGroup.associate = (models) => {
    // Un grupo tiene muchos rankings
    RankingGroup.hasMany(models.Ranking, {
      foreignKey: 'ranking_group_id',
      as: 'rankings'
    });

    // Creado por usuario
    RankingGroup.belongsTo(models.User, {
      foreignKey: 'created_by',
      as: 'creator'
    });

    // Actualizado por usuario
    RankingGroup.belongsTo(models.User, {
      foreignKey: 'last_updated_by',
      as: 'updatedBy'
    });
  };

  // Métodos estáticos
  RankingGroup.getActiveRankings = async function(options = {}) {
    const { includeInactive = false } = options;
    
    const whereConditions = {
      is_visible: true
    };

    if (!includeInactive) {
      whereConditions.is_active = true;
      // Solo rankings que están en el período activo
      whereConditions[Op.and] = [
        { start_date: { [Op.lte]: new Date() } },
        { end_date: { [Op.gte]: new Date() } }
      ];
    }

    return await this.findAll({
      where: whereConditions,
      include: [
        {
          model: sequelize.models.User,
          as: 'creator',
          attributes: ['id', 'username']
        },
        {
          model: sequelize.models.Ranking,
          as: 'rankings',
          include: [
            {
              model: sequelize.models.User,
              as: 'player',
              attributes: ['id', 'username', 'profile_data'],
              required: false
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });
  };

  RankingGroup.isDateRangeAvailable = async function(startDate, endDate, excludeId = null) {
    const whereConditions = {
      [Op.or]: [
        // Casos donde las fechas se superponen
        {
          start_date: {
            [Op.between]: [startDate, endDate]
          }
        },
        {
          end_date: {
            [Op.between]: [startDate, endDate]
          }
        },
        {
          [Op.and]: [
            { start_date: { [Op.lte]: startDate } },
            { end_date: { [Op.gte]: endDate } }
          ]
        }
      ]
    };

    if (excludeId) {
      whereConditions.id = { [Op.ne]: excludeId };
    }

    const overlapping = await this.findOne({ where: whereConditions });
    return !overlapping;
  };

  return RankingGroup;
};
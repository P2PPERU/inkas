module.exports = (sequelize, DataTypes) => {
  const RoulettePrize = sequelize.define('RoulettePrize', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'El nombre del premio es requerido'
        },
        len: {
          args: [3, 100],
          msg: 'El nombre debe tener entre 3 y 100 caracteres'
        }
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    prize_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'El tipo de premio es requerido'
        },
        len: {
          args: [3, 50],
          msg: 'El tipo debe tener entre 3 y 50 caracteres'
        }
      }
    },
    prize_behavior: {
      type: DataTypes.ENUM(
        'instant_cash',      // Dinero directo al balance
        'bonus',             // Crear bonus
        'manual',            // Procesamiento manual
        'custom'             // Comportamiento personalizado
      ),
      defaultValue: 'manual',
      allowNull: false
    },
    custom_config: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: true,
      get() {
        const value = this.getDataValue('custom_config');
        return value || {};
      }
    },
    prize_value: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00,
      validate: {
        min: {
          args: [0],
          msg: 'El valor del premio no puede ser negativo'
        }
      }
    },
    prize_metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      get() {
        const value = this.getDataValue('prize_metadata');
        return value || {};
      }
    },
    probability: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: {
          args: [0],
          msg: 'La probabilidad no puede ser negativa'
        },
        max: {
          args: [100],
          msg: 'La probabilidad no puede exceder 100%'
        }
      }
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    color: {
      type: DataTypes.STRING(7),
      defaultValue: '#000000',
      validate: {
        is: {
          args: /^#[0-9A-F]{6}$/i,
          msg: 'El color debe ser un código hexadecimal válido'
        }
      }
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      validate: {
        min: {
          args: [1],
          msg: 'La posición debe ser mayor a 0'
        },
        max: {
          args: [20],
          msg: 'La posición no puede exceder 20'
        }
      }
    },
    min_deposit_required: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00,
      validate: {
        min: {
          args: [0],
          msg: 'El depósito mínimo no puede ser negativo'
        }
      }
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'roulette_prizes',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
      beforeCreate: async (prize, options) => {
        // Validar que la posición no esté ocupada
        const existingPrize = await RoulettePrize.findOne({
          where: { position: prize.position }
        });
        if (existingPrize) {
          throw new Error('La posición ya está ocupada por otro premio');
        }
      },
      beforeUpdate: async (prize, options) => {
        // Si cambió la posición, validar que no esté ocupada
        if (prize.changed('position')) {
          const existingPrize = await RoulettePrize.findOne({
            where: { 
              position: prize.position,
              id: { [DataTypes.Op.ne]: prize.id }
            }
          });
          if (existingPrize) {
            throw new Error('La posición ya está ocupada por otro premio');
          }
        }
      }
    }
  });

  RoulettePrize.associate = (models) => {
    // Relación con el creador
    RoulettePrize.belongsTo(models.User, {
      foreignKey: 'created_by',
      as: 'creator'
    });

    // Relación con los giros
    RoulettePrize.hasMany(models.RouletteSpin, {
      foreignKey: 'prize_id',
      as: 'spins'
    });
  };

  // Métodos de clase
  RoulettePrize.validateProbabilities = async function() {
    const activePrizes = await this.findAll({
      where: { is_active: true }
    });
    
    const totalProbability = activePrizes.reduce((sum, prize) => 
      sum + parseFloat(prize.probability), 0
    );
    
    return {
      isValid: Math.abs(totalProbability - 100) < 0.01, // Tolerancia de 0.01%
      total: totalProbability,
      missing: 100 - totalProbability
    };
  };

  RoulettePrize.getRouletteConfiguration = async function() {
    const prizes = await this.findAll({
      where: { is_active: true },
      order: [['position', 'ASC']]
    });
    
    return prizes.map(prize => ({
      id: prize.id,
      name: prize.name,
      type: prize.prize_type,
      behavior: prize.prize_behavior,
      value: parseFloat(prize.prize_value),
      probability: parseFloat(prize.probability),
      color: prize.color,
      position: prize.position,
      metadata: prize.prize_metadata,
      customConfig: prize.custom_config
    }));
  };

  return RoulettePrize;
};
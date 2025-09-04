module.exports = (sequelize, DataTypes) => {
  const RouletteSpin = sequelize.define('RouletteSpin', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    prize_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'roulette_prizes',
        key: 'id'
      }
    },
    spin_type: {
      type: DataTypes.ENUM('demo', 'welcome_real', 'code', 'bonus'),
      allowNull: false,
      validate: {
        isIn: {
          args: [['demo', 'welcome_real', 'code', 'bonus']],
          msg: 'Tipo de giro inválido'
        }
      }
    },
    is_real_prize: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    code_used: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    spin_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    prize_status: {
      type: DataTypes.ENUM('pending_validation', 'applied', 'rejected', 'demo'),
      defaultValue: 'demo',
      validate: {
        isIn: {
          args: [['pending_validation', 'applied', 'rejected', 'demo']],
          msg: 'Estado del premio inválido'
        }
      }
    },
    validated_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    validated_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    prize_expiry_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'roulette_spins',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false, // No necesitamos updated_at para historial
    indexes: [
      {
        fields: ['user_id', 'spin_type'],
        name: 'user_spin_type_index'
      },
      {
        fields: ['prize_status'],
        name: 'prize_status_index'
      },
      {
        fields: ['spin_date'],
        name: 'spin_date_index'
      }
    ],
    hooks: {
      beforeCreate: async (spin, options) => {
        // Si es un giro real, verificar que el usuario puede girar
        if (spin.is_real_prize) {
          const user = await sequelize.models.User.findByPk(spin.user_id, {
            transaction: options.transaction
          });
          
          if (spin.spin_type === 'welcome_real' && !user.real_spin_available) {
            throw new Error('El usuario no tiene giro real disponible');
          }
        }
        
        // Establecer fecha de expiración según el tipo de premio si aplica
        if (spin.is_real_prize && !spin.prize_expiry_date) {
          const prize = await sequelize.models.RoulettePrize.findByPk(spin.prize_id, {
            transaction: options.transaction
          });
          
          // Si el premio tiene configuración de expiración
          if (prize.custom_config && prize.custom_config.expiry_days) {
            spin.prize_expiry_date = new Date(Date.now() + prize.custom_config.expiry_days * 24 * 60 * 60 * 1000);
          }
          // Por defecto 30 días para ciertos comportamientos
          else if (prize.prize_behavior === 'bonus') {
            spin.prize_expiry_date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          }
        }
      }
    }
  });

  RouletteSpin.associate = (models) => {
    // Usuario que giró
    RouletteSpin.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });

    // Premio ganado
    RouletteSpin.belongsTo(models.RoulettePrize, {
      foreignKey: 'prize_id',
      as: 'prize'
    });

    // Admin que validó
    RouletteSpin.belongsTo(models.User, {
      foreignKey: 'validated_by',
      as: 'validator'
    });
  };

  // Métodos de instancia
  RouletteSpin.prototype.applyPrize = async function(existingTransaction = null) {
    if (!this.is_real_prize || this.prize_status === 'applied') {
      throw new Error('Este premio no puede ser aplicado');
    }

    const shouldCreateTransaction = !existingTransaction;
    const t = existingTransaction || await sequelize.transaction();
    
    try {
      const prize = await sequelize.models.RoulettePrize.findByPk(this.prize_id, { transaction: t });
      const user = await sequelize.models.User.findByPk(this.user_id, { transaction: t });

      // Aplicar según el comportamiento del premio
      switch (prize.prize_behavior) {
        case 'instant_cash':
          // Dinero directo al balance
          user.balance = parseFloat(user.balance) + parseFloat(prize.prize_value);
          await user.save({ transaction: t });
          break;

        case 'bonus':
          // Crear bonus según configuración personalizada
          const bonusConfig = prize.custom_config || {};
          
          await sequelize.models.Bonus.create({
            name: bonusConfig.bonus_name || `Premio Ruleta: ${prize.name}`,
            description: prize.description || 'Premio ganado en la ruleta',
            type: bonusConfig.bonus_type || 'custom',
            amount: bonusConfig.fixed_amount || 0,
            percentage: bonusConfig.percentage || 0,
            max_bonus: prize.prize_value,
            min_deposit: bonusConfig.min_deposit || 0,
            assigned_to: this.user_id,
            assigned_by: this.validated_by || user.id,
            status: 'active',
            valid_until: this.prize_expiry_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }, { transaction: t });
          break;

        case 'custom':
          // Lógica personalizada según custom_config
          if (prize.custom_config.action === 'add_vip_points') {
            // Ejemplo: agregar puntos VIP
            user.vip_points = (user.vip_points || 0) + prize.prize_value;
            await user.save({ transaction: t });
          } else if (prize.custom_config.action === 'unlock_feature') {
            // Ejemplo: desbloquear característica
            const features = user.unlocked_features || [];
            features.push(prize.custom_config.feature_name);
            user.unlocked_features = features;
            await user.save({ transaction: t });
          }
          // Agregar más lógicas personalizadas según necesites
          break;

        case 'manual':
          // No hacer nada automático, requiere procesamiento manual
          console.log(`Premio manual pendiente de procesamiento: ${prize.name} para usuario ${user.username}`);
          break;

        default:
          console.log(`Comportamiento de premio no reconocido: ${prize.prize_behavior}`);
      }

      // Actualizar estado del giro
      this.prize_status = 'applied';
      this.validated_at = new Date();
      await this.save({ transaction: t });

      // Solo hacer commit si creamos la transacción
      if (shouldCreateTransaction) {
        await t.commit();
      }
      
      return true;
    } catch (error) {
      // Solo hacer rollback si creamos la transacción
      if (shouldCreateTransaction) {
        await t.rollback();
      }
      throw error;
    }
  };

  // Métodos estáticos
  RouletteSpin.getUserSpinStatus = async function(userId) {
    const user = await sequelize.models.User.findByPk(userId);
    
    const demoSpin = await this.findOne({
      where: {
        user_id: userId,
        spin_type: 'demo'
      }
    });

    const realSpin = await this.findOne({
      where: {
        user_id: userId,
        spin_type: 'welcome_real'
      }
    });

    const totalSpins = await this.count({
      where: { user_id: userId }
    });

    const availableSpins = await sequelize.models.Bonus.count({
      where: {
        assigned_to: userId,
        type: 'roulette_spin',
        status: 'active'
      }
    });

    return {
      has_demo_available: !user.first_spin_demo_used,
      has_real_available: user.real_spin_available,
      demo_spin_done: !!demoSpin,
      real_spin_done: !!realSpin,
      is_validated: user.validated_for_spin,
      total_spins: totalSpins,
      available_bonus_spins: availableSpins
    };
  };

  RouletteSpin.getPendingValidations = async function() {
    return await this.findAll({
      where: {
        spin_type: 'demo',
        prize_status: 'demo'
      },
      include: [
        {
          model: sequelize.models.User,
          as: 'user',
          where: {
            validated_for_spin: false
          },
          attributes: ['id', 'username', 'email', 'created_at']
        },
        {
          model: sequelize.models.RoulettePrize,
          as: 'prize',
          attributes: ['name', 'prize_type', 'prize_value']
        }
      ],
      order: [['created_at', 'ASC']]
    });
  };

  // Método para obtener estadísticas de giros
  RouletteSpin.getSpinStats = async function(userId = null, dateRange = {}) {
    const where = {};
    
    if (userId) {
      where.user_id = userId;
    }
    
    if (dateRange.startDate) {
      where.spin_date = where.spin_date || {};
      where.spin_date[DataTypes.Op.gte] = dateRange.startDate;
    }
    
    if (dateRange.endDate) {
      where.spin_date = where.spin_date || {};
      where.spin_date[DataTypes.Op.lte] = dateRange.endDate;
    }
    
    const stats = await this.findAll({
      where,
      attributes: [
        'spin_type',
        'prize_status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN is_real_prize = true THEN 1 END')), 'real_prizes']
      ],
      group: ['spin_type', 'prize_status']
    });
    
    return stats;
  };

  return RouletteSpin;
};
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
    hooks: {
      beforeCreate: async (spin, options) => {
        // Si es un giro real, verificar que el usuario puede girar
        if (spin.is_real_prize) {
          const user = await sequelize.models.User.findByPk(spin.user_id);
          
          if (spin.spin_type === 'welcome_real' && !user.real_spin_available) {
            throw new Error('El usuario no tiene giro real disponible');
          }
        }
        
        // Establecer fecha de expiración según el tipo de premio
        if (spin.is_real_prize && !spin.prize_expiry_date) {
          const prize = await sequelize.models.RoulettePrize.findByPk(spin.prize_id);
          
          // Tickets y bonos expiran en 30 días por defecto
          if (['tournament_ticket', 'deposit_bonus'].includes(prize.prize_type)) {
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
  RouletteSpin.prototype.applyPrize = async function() {
    if (!this.is_real_prize || this.prize_status === 'applied') {
      throw new Error('Este premio no puede ser aplicado');
    }

    const t = await sequelize.transaction();
    
    try {
      const prize = await sequelize.models.RoulettePrize.findByPk(this.prize_id);
      const user = await sequelize.models.User.findByPk(this.user_id);

      switch (prize.prize_type) {
        case 'cash_game_money':
          // Aplicar dinero directo al balance
          user.balance = parseFloat(user.balance) + parseFloat(prize.prize_value);
          await user.save({ transaction: t });
          break;

        case 'deposit_bonus':
          // Crear bonus para próximo depósito
          await sequelize.models.Bonus.create({
            name: `Bono Ruleta: ${prize.name}`,
            description: prize.description || 'Bono ganado en la ruleta',
            type: 'deposit',
            amount: 0, // Se calculará según el depósito
            percentage: prize.prize_metadata.bonus_percentage,
            max_bonus: prize.prize_value,
            assigned_to: this.user_id,
            assigned_by: this.validated_by || user.id,
            status: 'active',
            valid_until: this.prize_expiry_date
          }, { transaction: t });
          break;

        case 'tournament_ticket':
          // TODO: Implementar cuando tengamos módulo de torneos
          console.log('Ticket de torneo pendiente de implementación');
          break;

        case 'rakeback':
          // TODO: Implementar sistema de rakeback
          console.log('Rakeback pendiente de implementación');
          break;

        case 'merchandise':
          // TODO: Implementar sistema de mercancía
          console.log('Mercancía pendiente de implementación');
          break;
      }

      // Actualizar estado del giro
      this.prize_status = 'applied';
      this.validated_at = new Date();
      await this.save({ transaction: t });

      await t.commit();
      return true;
    } catch (error) {
      await t.rollback();
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

  return RouletteSpin;
};
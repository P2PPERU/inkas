const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50],
        isLowercase: true
      }
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      },
      set(value) {
        this.setDataValue('email', value.toLowerCase());
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [6, 100]
      }
    },
    role: {
      type: DataTypes.ENUM('admin', 'agent', 'editor', 'client'),
      defaultValue: 'client'
    },
    balance: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00,
      validate: {
        min: 0
      }
    },
    profile_data: {
      type: DataTypes.JSONB,
      defaultValue: {
        firstName: '',
        lastName: '',
        phone: '',
        avatar: null
      }
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true
    },
    parent_agent_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    // Campos para sistema de ruleta
    first_spin_demo_used: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    real_spin_available: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    validated_for_spin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    spin_validated_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    spin_validated_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'users',
    underscored: true,
    paranoid: true,
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      }
    }
  });

  User.prototype.comparePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
  };

  User.associate = (models) => {
    // Relación con agente padre
    User.belongsTo(models.User, {
      as: 'parentAgent',
      foreignKey: 'parent_agent_id'
    });

    // Clientes del agente
    User.hasMany(models.User, {
      as: 'clients',
      foreignKey: 'parent_agent_id'
    });

    // Perfil de afiliado (solo para agentes)
    User.hasOne(models.AffiliateProfile, {
      foreignKey: 'user_id',
      as: 'affiliateProfile'
    });

    // Bonificaciones
    User.hasMany(models.Bonus, {
      foreignKey: 'assigned_to',
      as: 'bonuses'
    });

    User.hasMany(models.Bonus, {
      foreignKey: 'assigned_by',
      as: 'assignedBonuses'
    });

    // Ranking
    User.hasOne(models.Ranking, {
      foreignKey: 'player_id',
      as: 'ranking'
    });

    // Noticias
    User.hasMany(models.News, {
      foreignKey: 'author_id',
      as: 'news'
    });

    // Códigos de ruleta
    User.hasMany(models.RouletteCode, {
      foreignKey: 'created_by',
      as: 'createdRouletteCodes'
    });

    User.hasMany(models.RouletteCode, {
      foreignKey: 'used_by',
      as: 'usedRouletteCodes'
    });

    // Historial de afiliación
    User.hasMany(models.AffiliationHistory, {
      foreignKey: 'client_id',
      as: 'affiliationHistory'
    });

    // Ruleta - Giros
    User.hasMany(models.RouletteSpin, {
      foreignKey: 'user_id',
      as: 'rouletteSpins'
    });

    // Ruleta - Validador
    User.belongsTo(models.User, {
      foreignKey: 'spin_validated_by',
      as: 'spinValidator'
    });

    // Ruleta - Premios creados (admin)
    User.hasMany(models.RoulettePrize, {
      foreignKey: 'created_by',
      as: 'createdRoulettePrizes'
    });
  };

  return User;
};
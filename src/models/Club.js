module.exports = (sequelize, DataTypes) => {
  const Club = sequelize.define('Club', {
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
          msg: 'El nombre del club es requerido'
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
    owner_phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'El teléfono del dueño es requerido'
        },
        is: {
          args: /^\+?[1-9]\d{1,14}$/,
          msg: 'Formato de teléfono inválido'
        }
      }
    },
    owner_name: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    logo_url: {
      type: DataTypes.STRING,
      allowNull: true
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    city: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    country: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'Perú'
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        isEmail: {
          msg: 'Email inválido'
        }
      }
    },
    website: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isUrl: {
          msg: 'URL del sitio web inválida'
        }
      }
    },
    social_media: {
      type: DataTypes.JSONB,
      defaultValue: {},
      get() {
        const value = this.getDataValue('social_media');
        return value || {};
      }
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    established_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    member_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    club_type: {
      type: DataTypes.ENUM('casino', 'poker_room', 'tournament_club', 'online', 'mixed'),
      defaultValue: 'poker_room'
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'pending', 'suspended'),
      defaultValue: 'active'
    },
    settings: {
      type: DataTypes.JSONB,
      defaultValue: {},
      get() {
        const value = this.getDataValue('settings');
        return value || {};
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
    tableName: 'clubs',
    underscored: true,
    paranoid: true,
    indexes: [
      {
        fields: ['name']
      },
      {
        fields: ['city']
      },
      {
        fields: ['status']
      },
      {
        fields: ['is_active']
      }
    ]
  });

  Club.associate = (models) => {
    // Creador del club
    Club.belongsTo(models.User, {
      foreignKey: 'created_by',
      as: 'creator'
    });

    // Un club puede tener muchos usuarios (miembros)
    Club.belongsToMany(models.User, {
      through: 'club_memberships',
      foreignKey: 'club_id',
      otherKey: 'user_id',
      as: 'members'
    });
  };

  // Métodos estáticos
  Club.getActiveClubs = async function() {
    return await this.findAll({
      where: {
        is_active: true,
        status: 'active'
      },
      include: [{
        model: sequelize.models.User,
        as: 'creator',
        attributes: ['username']
      }],
      order: [['name', 'ASC']]
    });
  };

  Club.searchClubs = async function(query) {
    return await this.findAll({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { name: { [sequelize.Sequelize.Op.iLike]: `%${query}%` } },
          { city: { [sequelize.Sequelize.Op.iLike]: `%${query}%` } },
          { description: { [sequelize.Sequelize.Op.iLike]: `%${query}%` } }
        ],
        is_active: true
      },
      limit: 10
    });
  };

  return Club;
};
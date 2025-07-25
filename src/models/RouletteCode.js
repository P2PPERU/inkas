module.exports = (sequelize, DataTypes) => {
  const RouletteCode = sequelize.define('RouletteCode', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true
    },
    grants_spin: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    used_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    used_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'roulette_codes',
    underscored: true,
    paranoid: true
  });

  RouletteCode.associate = (models) => {
    RouletteCode.belongsTo(models.User, {
      foreignKey: 'created_by',
      as: 'creator'
    });

    RouletteCode.belongsTo(models.User, {
      foreignKey: 'used_by',
      as: 'usedBy'
    });
  };

  return RouletteCode;
};
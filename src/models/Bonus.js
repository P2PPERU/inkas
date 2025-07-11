module.exports = (sequelize, DataTypes) => {
  const Bonus = sequelize.define('Bonus', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    type: {
      type: DataTypes.ENUM('welcome', 'deposit', 'referral', 'achievement', 'custom', 'roulette_spin'),
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    percentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    min_deposit: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    max_bonus: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    assigned_to: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    assigned_by: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'claimed', 'expired'),
      defaultValue: 'pending'
    },
    valid_from: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    valid_until: {
      type: DataTypes.DATE,
      allowNull: true
    },
    claimed_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'bonuses',
    underscored: true,
    paranoid: true
  });

  Bonus.associate = (models) => {
    Bonus.belongsTo(models.User, {
      foreignKey: 'assigned_to',
      as: 'assignedTo'
    });

    Bonus.belongsTo(models.User, {
      foreignKey: 'assigned_by',
      as: 'assignedBy'
    });
  };

  return Bonus;
};
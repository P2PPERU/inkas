module.exports = (sequelize, DataTypes) => {
  const AffiliationHistory = sequelize.define('AffiliationHistory', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    client_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    agent_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    affiliate_code_used: {
      type: DataTypes.STRING,
      allowNull: true
    },
    bonus_applied: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    ip_address: {
      type: DataTypes.INET,
      allowNull: true
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    referral_source: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    tableName: 'affiliation_history',
    underscored: true,
    updatedAt: false
  });

  AffiliationHistory.associate = (models) => {
    AffiliationHistory.belongsTo(models.User, {
      foreignKey: 'client_id',
      as: 'client'
    });

    AffiliationHistory.belongsTo(models.User, {
      foreignKey: 'agent_id',
      as: 'agent'
    });
  };

  return AffiliationHistory;
};
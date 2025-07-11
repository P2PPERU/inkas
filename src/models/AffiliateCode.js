module.exports = (sequelize, DataTypes) => {
  const AffiliateCode = sequelize.define('AffiliateCode', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    affiliate_profile_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'affiliate_profiles',
        key: 'id'
      }
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true
    },
    bonus_amount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    usage_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    max_uses: {
      type: DataTypes.INTEGER,
      allowNull: true // null = ilimitado
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'affiliate_codes',
    underscored: true,
    paranoid: true
  });

  AffiliateCode.associate = (models) => {
    AffiliateCode.belongsTo(models.AffiliateProfile, {
      foreignKey: 'affiliate_profile_id',
      as: 'affiliateProfile'
    });
  };

  return AffiliateCode;
};
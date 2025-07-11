module.exports = (sequelize, DataTypes) => {
  const AffiliateProfile = sequelize.define('AffiliateProfile', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    affiliate_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true
    },
    commission_rate: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 10.00,
      validate: {
        min: 0,
        max: 100
      }
    },
    total_referrals: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    total_earnings: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    custom_url: {
      type: DataTypes.STRING,
      allowNull: true
    },
    marketing_materials: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'affiliate_profiles',
    underscored: true,
    paranoid: true
  });

  AffiliateProfile.associate = (models) => {
    AffiliateProfile.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });

    AffiliateProfile.hasMany(models.AffiliateCode, {
      foreignKey: 'affiliate_profile_id',
      as: 'codes'
    });
  };

  return AffiliateProfile;
};
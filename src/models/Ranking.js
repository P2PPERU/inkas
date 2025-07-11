module.exports = (sequelize, DataTypes) => {
  const Ranking = sequelize.define('Ranking', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    player_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    points: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    games_played: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    wins: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    losses: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    win_rate: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0.00
    },
    season: {
      type: DataTypes.STRING,
      defaultValue: () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    history: {
      type: DataTypes.JSONB,
      defaultValue: []
    }
  }, {
    tableName: 'rankings',
    underscored: true,
    paranoid: true,
    hooks: {
      beforeSave: (ranking) => {
        if (ranking.games_played > 0) {
          ranking.win_rate = (ranking.wins / ranking.games_played * 100).toFixed(2);
        }
      }
    }
  });

  Ranking.associate = (models) => {
    Ranking.belongsTo(models.User, {
      foreignKey: 'player_id',
      as: 'player'
    });
  };

  return Ranking;
};
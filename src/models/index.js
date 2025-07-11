const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config/database');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  dbConfig
);

const db = {};

// Importar modelos
db.User = require('./User')(sequelize, DataTypes);
db.AffiliateProfile = require('./AffiliateProfile')(sequelize, DataTypes);
db.AffiliateCode = require('./AffiliateCode')(sequelize, DataTypes);
db.AffiliationHistory = require('./AffiliationHistory')(sequelize, DataTypes);
db.Bonus = require('./Bonus')(sequelize, DataTypes);
db.Ranking = require('./Ranking')(sequelize, DataTypes);
db.News = require('./News')(sequelize, DataTypes);
db.RouletteCode = require('./RouletteCode')(sequelize, DataTypes);

// Definir asociaciones
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
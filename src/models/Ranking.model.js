const mongoose = require('mongoose');

const rankingSchema = new mongoose.Schema({
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  points: {
    type: Number,
    default: 0
  },
  gamesPlayed: {
    type: Number,
    default: 0
  },
  wins: {
    type: Number,
    default: 0
  },
  losses: {
    type: Number,
    default: 0
  },
  winRate: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  history: [{
    date: Date,
    points: Number,
    position: Number
  }]
});

// Calcular winRate automáticamente
rankingSchema.pre('save', function(next) {
  if (this.gamesPlayed > 0) {
    this.winRate = (this.wins / this.gamesPlayed) * 100;
  }
  this.lastUpdated = Date.now();
  next();
});

module.exports = mongoose.model('Ranking', rankingSchema);
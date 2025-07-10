const mongoose = require('mongoose');

const rouletteCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  prize: {
    type: {
      type: String,
      enum: ['bonus', 'points', 'free_spin', 'discount'],
      required: true
    },
    value: {
      type: Number,
      required: true
    },
    description: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: Date,
  usedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('RouletteCode', rouletteCodeSchema);
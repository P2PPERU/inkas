const mongoose = require('mongoose');

const bonusSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  type: {
    type: String,
    enum: ['welcome', 'deposit', 'referral', 'achievement', 'custom'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  percentage: Number,
  minDeposit: {
    type: Number,
    default: 0
  },
  maxBonus: Number,
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'claimed', 'expired'],
    default: 'pending'
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: Date,
  claimedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Bonus', bonusSchema);
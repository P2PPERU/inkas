const Bonus = require('../models/Bonus.model');
const User = require('../models/User.model');

// Crear bonificación
exports.createBonus = async (req, res) => {
  try {
    const { 
      name, 
      description, 
      type, 
      amount, 
      percentage,
      minDeposit,
      maxBonus,
      assignedTo, 
      validUntil 
    } = req.body;

    // Verificar permisos
    if (req.user.role === 'agent') {
      // Verificar que el cliente pertenezca al agente
      const client = await User.findById(assignedTo);
      if (!client || client.parentAgent.toString() !== req.user.id) {
        return res.status(403).json({ 
          message: 'No tienes permiso para asignar bonus a este cliente' 
        });
      }
    }

    const bonus = await Bonus.create({
      name,
      description,
      type,
      amount,
      percentage,
      minDeposit,
      maxBonus,
      assignedTo,
      assignedBy: req.user.id,
      validUntil
    });

    res.status(201).json({
      success: true,
      bonus
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al crear bonificación',
      error: error.message 
    });
  }
};

// Obtener bonificaciones del usuario
exports.getUserBonuses = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;

    const bonuses = await Bonus.find({ 
      assignedTo: userId,
      status: { $in: ['pending', 'active'] }
    })
    .populate('assignedBy', 'username')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      bonuses
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al obtener bonificaciones',
      error: error.message 
    });
  }
};

// Reclamar bonificación
exports.claimBonus = async (req, res) => {
  try {
    const { bonusId } = req.params;

    const bonus = await Bonus.findOne({
      _id: bonusId,
      assignedTo: req.user.id,
      status: { $in: ['pending', 'active'] }
    });

    if (!bonus) {
      return res.status(404).json({ 
        message: 'Bonificación no encontrada o no disponible' 
      });
    }

    // Verificar validez
    if (bonus.validUntil && bonus.validUntil < Date.now()) {
      bonus.status = 'expired';
      await bonus.save();
      return res.status(400).json({ 
        message: 'Bonificación expirada' 
      });
    }

    // Aplicar bonificación al balance del usuario
    const user = await User.findById(req.user.id);
    user.balance += bonus.amount;
    await user.save();

    // Marcar como reclamada
    bonus.status = 'claimed';
    bonus.claimedAt = Date.now();
    await bonus.save();

    res.json({
      success: true,
      message: 'Bonificación reclamada exitosamente',
      newBalance: user.balance
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al reclamar bonificación',
      error: error.message 
    });
  }
};
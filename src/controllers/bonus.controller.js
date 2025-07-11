const { Bonus, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../models').sequelize;

// Crear bonificación
exports.createBonus = async (req, res) => {
  const t = await sequelize.transaction();
  
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
      const client = await User.findOne({
        where: {
          id: assignedTo,
          parent_agent_id: req.user.id
        }
      });
      
      if (!client) {
        await t.rollback();
        return res.status(403).json({ 
          message: 'No tienes permiso para asignar bonus a este cliente' 
        });
      }
    }

    // Verificar que el usuario destino existe
    const targetUser = await User.findByPk(assignedTo);
    if (!targetUser) {
      await t.rollback();
      return res.status(404).json({ 
        message: 'Usuario destino no encontrado' 
      });
    }

    const bonus = await Bonus.create({
      name,
      description,
      type,
      amount,
      percentage,
      min_deposit: minDeposit,
      max_bonus: maxBonus,
      assigned_to: assignedTo,
      assigned_by: req.user.id,
      valid_until: validUntil,
      status: 'active' // Los bonus se crean activos
    }, { transaction: t });

    await t.commit();

    // Recargar con relaciones
    const createdBonus = await Bonus.findByPk(bonus.id, {
      include: [
        {
          model: User,
          as: 'assignedTo',
          attributes: ['id', 'username', 'email']
        },
        {
          model: User,
          as: 'assignedBy',
          attributes: ['id', 'username']
        }
      ]
    });

    res.status(201).json({
      success: true,
      bonus: createdBonus
    });
  } catch (error) {
    await t.rollback();
    console.error('Error al crear bonificación:', error);
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

    // Si es un agente verificando bonos de un cliente
    if (req.params.userId && req.user.role === 'agent') {
      const client = await User.findOne({
        where: {
          id: userId,
          parent_agent_id: req.user.id
        }
      });
      
      if (!client) {
        return res.status(403).json({ 
          message: 'No tienes permiso para ver los bonos de este usuario' 
        });
      }
    }

    const bonuses = await Bonus.findAll({
      where: { 
        assigned_to: userId,
        status: { [Op.in]: ['pending', 'active'] }
      },
      include: [{
        model: User,
        as: 'assignedBy',
        attributes: ['username']
      }],
      order: [['created_at', 'DESC']]
    });

    // Verificar y actualizar bonos expirados
    const now = new Date();
    for (const bonus of bonuses) {
      if (bonus.valid_until && bonus.valid_until < now && bonus.status === 'active') {
        bonus.status = 'expired';
        await bonus.save();
      }
    }

    res.json({
      success: true,
      bonuses: bonuses.filter(b => b.status !== 'expired')
    });
  } catch (error) {
    console.error('Error al obtener bonificaciones:', error);
    res.status(500).json({ 
      message: 'Error al obtener bonificaciones',
      error: error.message 
    });
  }
};

// Reclamar bonificación
exports.claimBonus = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { bonusId } = req.params;

    const bonus = await Bonus.findOne({
      where: {
        id: bonusId,
        assigned_to: req.user.id,
        status: { [Op.in]: ['pending', 'active'] }
      },
      transaction: t,
      lock: true // Bloquear fila para evitar doble claim
    });

    if (!bonus) {
      await t.rollback();
      return res.status(404).json({ 
        message: 'Bonificación no encontrada o no disponible' 
      });
    }

    // Verificar validez
    if (bonus.valid_until && bonus.valid_until < new Date()) {
      bonus.status = 'expired';
      await bonus.save({ transaction: t });
      await t.rollback();
      return res.status(400).json({ 
        message: 'Bonificación expirada' 
      });
    }

    // Aplicar bonificación al balance del usuario
    const user = await User.findByPk(req.user.id, { transaction: t });
    
    const previousBalance = parseFloat(user.balance);
    const bonusAmount = parseFloat(bonus.amount);
    user.balance = previousBalance + bonusAmount;
    
    await user.save({ transaction: t });

    // Marcar como reclamada
    bonus.status = 'claimed';
    bonus.claimed_at = new Date();
    await bonus.save({ transaction: t });

    await t.commit();

    res.json({
      success: true,
      message: 'Bonificación reclamada exitosamente',
      previousBalance,
      bonusAmount,
      newBalance: user.balance
    });
  } catch (error) {
    await t.rollback();
    console.error('Error al reclamar bonificación:', error);
    res.status(500).json({ 
      message: 'Error al reclamar bonificación',
      error: error.message 
    });
  }
};

// Obtener todas las bonificaciones (Admin)
exports.getAllBonuses = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status = 'all',
      type = 'all',
      assignedBy
    } = req.query;
    
    const offset = (page - 1) * limit;
    const whereConditions = {};
    
    if (status !== 'all') {
      whereConditions.status = status;
    }
    
    if (type !== 'all') {
      whereConditions.type = type;
    }
    
    if (assignedBy) {
      whereConditions.assigned_by = assignedBy;
    }

    const { count, rows: bonuses } = await Bonus.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'assignedTo',
          attributes: ['id', 'username', 'email', 'balance']
        },
        {
          model: User,
          as: 'assignedBy',
          attributes: ['id', 'username', 'role']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    res.json({
      success: true,
      bonuses,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalBonuses: count
    });
  } catch (error) {
    console.error('Error al obtener todas las bonificaciones:', error);
    res.status(500).json({ 
      message: 'Error al obtener bonificaciones',
      error: error.message 
    });
  }
};

// Actualizar estado de bonificación (Admin)
exports.updateBonusStatus = async (req, res) => {
  try {
    const { bonusId } = req.params;
    const { status } = req.body;

    const bonus = await Bonus.findByPk(bonusId);

    if (!bonus) {
      return res.status(404).json({ 
        message: 'Bonificación no encontrada' 
      });
    }

    // Validar transiciones de estado
    if (bonus.status === 'claimed' && status !== 'claimed') {
      return res.status(400).json({ 
        message: 'No se puede cambiar el estado de un bono ya reclamado' 
      });
    }

    bonus.status = status;
    await bonus.save();

    res.json({
      success: true,
      message: 'Estado actualizado exitosamente',
      bonus
    });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ 
      message: 'Error al actualizar estado',
      error: error.message 
    });
  }
};

// Obtener estadísticas de bonificaciones
exports.getBonusStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter = {};
    if (startDate) dateFilter[Op.gte] = new Date(startDate);
    if (endDate) dateFilter[Op.lte] = new Date(endDate);

    // Estadísticas generales
    const stats = await Bonus.findAll({
      where: {
        ...(Object.keys(dateFilter).length && { 
          created_at: dateFilter 
        })
      },
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount']
      ],
      group: ['status']
    });

    // Estadísticas por tipo
    const statsByType = await Bonus.findAll({
      where: {
        ...(Object.keys(dateFilter).length && { 
          created_at: dateFilter 
        })
      },
      attributes: [
        'type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount'],
        [sequelize.fn('AVG', sequelize.col('amount')), 'avgAmount']
      ],
      group: ['type']
    });

    // Top creadores de bonos
    const topCreators = await Bonus.findAll({
      where: {
        ...(Object.keys(dateFilter).length && { 
          created_at: dateFilter 
        })
      },
      attributes: [
        'assigned_by',
        [sequelize.fn('COUNT', sequelize.col('id')), 'bonusCount'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAssigned']
      ],
      include: [{
        model: User,
        as: 'assignedBy',
        attributes: ['username', 'role']
      }],
      group: ['assigned_by', 'assignedBy.id'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      limit: 5
    });

    res.json({
      success: true,
      stats: {
        byStatus: stats.map(s => ({
          status: s.status,
          count: parseInt(s.dataValues.count),
          totalAmount: parseFloat(s.dataValues.totalAmount) || 0
        })),
        byType: statsByType.map(s => ({
          type: s.type,
          count: parseInt(s.dataValues.count),
          totalAmount: parseFloat(s.dataValues.totalAmount) || 0,
          avgAmount: parseFloat(s.dataValues.avgAmount) || 0
        })),
        topCreators: topCreators.map(creator => ({
          user: creator.assignedBy.username,
          role: creator.assignedBy.role,
          bonusCount: parseInt(creator.dataValues.bonusCount),
          totalAssigned: parseFloat(creator.dataValues.totalAssigned) || 0
        }))
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ 
      message: 'Error al obtener estadísticas',
      error: error.message 
    });
  }
};

// Eliminar bonificación (Admin - solo si no ha sido reclamada)
exports.deleteBonus = async (req, res) => {
  try {
    const { bonusId } = req.params;

    const bonus = await Bonus.findByPk(bonusId);

    if (!bonus) {
      return res.status(404).json({ 
        message: 'Bonificación no encontrada' 
      });
    }

    if (bonus.status === 'claimed') {
      return res.status(400).json({ 
        message: 'No se puede eliminar una bonificación ya reclamada' 
      });
    }

    // Soft delete
    await bonus.destroy();

    res.json({
      success: true,
      message: 'Bonificación eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar bonificación:', error);
    res.status(500).json({ 
      message: 'Error al eliminar bonificación',
      error: error.message 
    });
  }
};
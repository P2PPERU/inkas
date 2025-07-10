const User = require('../models/User.model');
const Bonus = require('../models/Bonus.model');
const RouletteCode = require('../models/RouletteCode.model');
const Transaction = require('../models/Transaction.model');

// Obtener clientes del agente
exports.getMyClients = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all' } = req.query;

    const filter = { parentAgent: req.user.id };
    
    if (status !== 'all') {
      filter.isActive = status === 'active';
    }

    const clients = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await User.countDocuments(filter);

    // Estadísticas adicionales
    const stats = {
      totalClients: count,
      activeClients: await User.countDocuments({ 
        parentAgent: req.user.id, 
        isActive: true 
      }),
      totalBalance: clients.reduce((sum, client) => sum + client.balance, 0)
    };

    res.json({
      success: true,
      clients,
      stats,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al obtener clientes',
      error: error.message 
    });
  }
};

// Crear cliente
exports.createClient = async (req, res) => {
  try {
    const { username, email, password, profile } = req.body;

    // Verificar si el usuario existe
    const userExists = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (userExists) {
      return res.status(400).json({ 
        message: 'El usuario o email ya existe' 
      });
    }

    // Crear cliente asignado al agente
    const client = await User.create({
      username,
      email,
      password,
      profile,
      role: 'client',
      parentAgent: req.user.id
    });

    // Remover password de la respuesta
    const clientResponse = client.toObject();
    delete clientResponse.password;

    res.status(201).json({
      success: true,
      client: clientResponse
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al crear cliente',
      error: error.message 
    });
  }
};

// Actualizar cliente
exports.updateClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { profile, isActive } = req.body;

    const client = await User.findOne({ 
      _id: clientId,
      parentAgent: req.user.id 
    });

    if (!client) {
      return res.status(404).json({ 
        message: 'Cliente no encontrado o no tienes permiso' 
      });
    }

    // Actualizar datos permitidos
    if (profile) {
      client.profile = { ...client.profile, ...profile };
    }
    
    if (typeof isActive === 'boolean') {
      client.isActive = isActive;
    }

    await client.save();

    res.json({
      success: true,
      client: {
        id: client._id,
        username: client.username,
        email: client.email,
        profile: client.profile,
        isActive: client.isActive
      }
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al actualizar cliente',
      error: error.message 
    });
  }
};

// Asignar bonificación a cliente
exports.assignBonusToClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const bonusData = req.body;

    // Verificar que el cliente pertenezca al agente
    const client = await User.findOne({ 
      _id: clientId,
      parentAgent: req.user.id 
    });

    if (!client) {
      return res.status(404).json({ 
        message: 'Cliente no encontrado o no tienes permiso' 
      });
    }

    // Crear bonificación
    const bonus = await Bonus.create({
      ...bonusData,
      assignedTo: clientId,
      assignedBy: req.user.id
    });

    res.status(201).json({
      success: true,
      bonus
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al asignar bonificación',
      error: error.message 
    });
  }
};

// Obtener estadísticas del agente
exports.getAgentStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    // Clientes
    const totalClients = await User.countDocuments({ 
      parentAgent: req.user.id 
    });
    
    const activeClients = await User.countDocuments({ 
      parentAgent: req.user.id,
      isActive: true 
    });

    // Bonificaciones
    const bonusStats = await Bonus.aggregate([
      {
        $match: {
          assignedBy: req.user.id,
          ...(Object.keys(dateFilter).length && { 
            createdAt: dateFilter 
          })
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    // Códigos de ruleta
    const rouletteStats = await RouletteCode.aggregate([
      {
        $match: {
          createdBy: req.user.id,
          ...(Object.keys(dateFilter).length && { 
            createdAt: dateFilter 
          })
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          used: { 
            $sum: { $cond: [{ $ne: ['$usedBy', null] }, 1, 0] } 
          },
          active: { 
            $sum: { $cond: ['$isActive', 1, 0] } 
          }
        }
      }
    ]);

    res.json({
      success: true,
      stats: {
        clients: {
          total: totalClients,
          active: activeClients,
          inactive: totalClients - activeClients
        },
        bonuses: bonusStats,
        rouletteCodes: rouletteStats[0] || {
          total: 0,
          used: 0,
          active: 0
        }
      }
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al obtener estadísticas',
      error: error.message 
    });
  }
};

// Obtener actividad reciente
exports.getRecentActivity = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    // Obtener IDs de clientes del agente
    const clientIds = await User.find({ 
      parentAgent: req.user.id 
    }).distinct('_id');

    // Bonificaciones recientes
    const recentBonuses = await Bonus.find({
      $or: [
        { assignedBy: req.user.id },
        { assignedTo: { $in: clientIds } }
      ]
    })
    .populate('assignedTo', 'username')
    .sort({ createdAt: -1 })
    .limit(5);

    // Códigos usados recientemente
    const recentCodes = await RouletteCode.find({
      createdBy: req.user.id,
      usedBy: { $ne: null }
    })
    .populate('usedBy', 'username')
    .sort({ usedAt: -1 })
    .limit(5);

    // Combinar y ordenar actividades
    const activities = [
      ...recentBonuses.map(bonus => ({
        type: 'bonus',
        description: `Bonificación "${bonus.name}" asignada a ${bonus.assignedTo.username}`,
        date: bonus.createdAt,
        data: bonus
      })),
      ...recentCodes.map(code => ({
        type: 'roulette',
        description: `Código ${code.code} usado por ${code.usedBy.username}`,
        date: code.usedAt,
        data: code
      }))
    ]
    .sort((a, b) => b.date - a.date)
    .slice(0, limit);

    res.json({
      success: true,
      activities
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al obtener actividad reciente',
      error: error.message 
    });
  }
};

// Dashboard del agente
exports.getAgentDashboard = async (req, res) => {
  try {
    // Clientes activos hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeToday = await User.countDocuments({
      parentAgent: req.user.id,
      lastLogin: { $gte: today }
    });

    // Bonificaciones pendientes
    const pendingBonuses = await Bonus.countDocuments({
      assignedBy: req.user.id,
      status: 'pending'
    });

    // Códigos activos
    const activeCodes = await RouletteCode.countDocuments({
      createdBy: req.user.id,
      isActive: true
    });

    // Top 5 clientes por balance
    const topClients = await User.find({
      parentAgent: req.user.id
    })
    .select('username profile balance')
    .sort({ balance: -1 })
    .limit(5);

    res.json({
      success: true,
      dashboard: {
        activeToday,
        pendingBonuses,
        activeCodes,
        topClients
      }
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al obtener dashboard',
      error: error.message 
    });
  }
};
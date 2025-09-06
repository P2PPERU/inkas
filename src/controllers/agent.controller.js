// src/controllers/agent.controller.js
const { User, Bonus, RouletteCode, AffiliateProfile, AffiliateCode, AffiliationHistory } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../models').sequelize;

// Obtener clientes del agente
exports.getMyClients = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all' } = req.query;
    const offset = (page - 1) * limit;

    const whereConditions = { parent_agent_id: req.user.id };
    
    if (status !== 'all') {
      whereConditions.is_active = status === 'active';
    }

    const { count, rows: clients } = await User.findAndCountAll({
      where: whereConditions,
      attributes: { exclude: ['password'] },
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    // Estadísticas adicionales
    const stats = {
      totalClients: count,
      activeClients: await User.count({ 
        where: { 
          parent_agent_id: req.user.id, 
          is_active: true 
        }
      })
    };

    res.json({
      success: true,
      clients,
      stats,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ 
      message: 'Error al obtener clientes',
      error: error.message 
    });
  }
};

// Crear cliente
exports.createClient = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { username, email, password, firstName, lastName, phone } = req.body;

    // Verificar si el usuario existe
    const userExists = await User.findOne({
      where: {
        [Op.or]: [{ email }, { username }]
      }
    });
    
    if (userExists) {
      await t.rollback();
      return res.status(400).json({ 
        message: 'El usuario o email ya existe' 
      });
    }

    // Crear cliente asignado al agente
    const client = await User.create({
      username,
      email,
      password,
      profile_data: {
        firstName: firstName || '',
        lastName: lastName || '',
        phone: phone || '',
        avatar: null
      },
      role: 'client',
      parent_agent_id: req.user.id
    }, { transaction: t });

    // Registrar en historial de afiliación
    await AffiliationHistory.create({
      client_id: client.id,
      agent_id: req.user.id,
      bonus_applied: 0,
      ip_address: req.ip,
      user_agent: req.get('user-agent')
    }, { transaction: t });

    // Actualizar contador del afiliado
    await AffiliateProfile.increment('total_referrals', {
      where: { user_id: req.user.id },
      transaction: t
    });

    await t.commit();

    res.status(201).json({
      success: true,
      client: {
        id: client.id,
        username: client.username,
        email: client.email,
        profile: client.profile_data
      }
    });
  } catch (error) {
    await t.rollback();
    console.error('Error al crear cliente:', error);
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
    const { firstName, lastName, phone, isActive } = req.body;

    const client = await User.findOne({
      where: {
        id: clientId,
        parent_agent_id: req.user.id
      }
    });

    if (!client) {
      return res.status(404).json({ 
        message: 'Cliente no encontrado o no tienes permiso' 
      });
    }

    // Actualizar datos permitidos
    if (firstName !== undefined || lastName !== undefined || phone !== undefined) {
      client.profile_data = {
        ...client.profile_data,
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone })
      };
    }
    
    if (typeof isActive === 'boolean') {
      client.is_active = isActive;
    }

    await client.save();

    res.json({
      success: true,
      client: {
        id: client.id,
        username: client.username,
        email: client.email,
        profile: client.profile_data,
        isActive: client.is_active
      }
    });
  } catch (error) {
    console.error('Error al actualizar cliente:', error);
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
      where: {
        id: clientId,
        parent_agent_id: req.user.id
      }
    });

    if (!client) {
      return res.status(404).json({ 
        message: 'Cliente no encontrado o no tienes permiso' 
      });
    }

    // Crear bonificación
    const bonus = await Bonus.create({
      ...bonusData,
      assigned_to: clientId,
      assigned_by: req.user.id
    });

    res.status(201).json({
      success: true,
      bonus
    });
  } catch (error) {
    console.error('Error al asignar bonificación:', error);
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
    if (startDate) dateFilter[Op.gte] = new Date(startDate);
    if (endDate) dateFilter[Op.lte] = new Date(endDate);

    // Clientes
    const totalClients = await User.count({
      where: { parent_agent_id: req.user.id }
    });
    
    const activeClients = await User.count({
      where: { 
        parent_agent_id: req.user.id,
        is_active: true 
      }
    });

    // Bonificaciones
    const bonusStats = await Bonus.findAll({
      where: {
        assigned_by: req.user.id,
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

    // Códigos de ruleta
    const rouletteStats = await RouletteCode.findOne({
      where: {
        created_by: req.user.id,
        ...(Object.keys(dateFilter).length && { 
          created_at: dateFilter 
        })
      },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN used_by IS NOT NULL THEN 1 END")), 'used'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN is_active = true THEN 1 END")), 'active']
      ]
    });

    // Estadísticas de afiliación
    const affiliateProfile = await AffiliateProfile.findOne({
      where: { user_id: req.user.id }
    });

    res.json({
      success: true,
      stats: {
        clients: {
          total: totalClients,
          active: activeClients,
          inactive: totalClients - activeClients
        },
        bonuses: bonusStats.map(stat => ({
          status: stat.status,
          count: parseInt(stat.dataValues.count),
          totalAmount: parseFloat(stat.dataValues.totalAmount) || 0
        })),
        rouletteCodes: {
          total: parseInt(rouletteStats?.dataValues.total) || 0,
          used: parseInt(rouletteStats?.dataValues.used) || 0,
          active: parseInt(rouletteStats?.dataValues.active) || 0
        },
        affiliate: {
          totalReferrals: affiliateProfile?.total_referrals || 0,
          totalEarnings: parseFloat(affiliateProfile?.total_earnings) || 0,
          commissionRate: parseFloat(affiliateProfile?.commission_rate) || 0
        }
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

// Obtener actividad reciente
exports.getRecentActivity = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    // Obtener IDs de clientes del agente
    const clients = await User.findAll({
      where: { parent_agent_id: req.user.id },
      attributes: ['id']
    });
    const clientIds = clients.map(c => c.id);

    // Bonificaciones recientes
    const recentBonuses = await Bonus.findAll({
      where: {
        [Op.or]: [
          { assigned_by: req.user.id },
          { assigned_to: { [Op.in]: clientIds } }
        ]
      },
      include: [{
        model: User,
        as: 'assignedTo',
        attributes: ['username']
      }],
      order: [['created_at', 'DESC']],
      limit: 5
    });

    // Códigos usados recientemente
    const recentCodes = await RouletteCode.findAll({
      where: {
        created_by: req.user.id,
        used_by: { [Op.ne]: null }
      },
      include: [{
        model: User,
        as: 'usedBy',
        attributes: ['username']
      }],
      order: [['used_at', 'DESC']],
      limit: 5
    });

    // Nuevas afiliaciones
    const recentAffiliations = await AffiliationHistory.findAll({
      where: { agent_id: req.user.id },
      include: [{
        model: User,
        as: 'client',
        attributes: ['username', 'email']
      }],
      order: [['created_at', 'DESC']],
      limit: 5
    });

    // Combinar y ordenar actividades
    const activities = [
      ...recentBonuses.map(bonus => ({
        type: 'bonus',
        description: `Bonificación "${bonus.name}" asignada a ${bonus.assignedTo.username}`,
        date: bonus.created_at,
        data: bonus
      })),
      ...recentCodes.map(code => ({
        type: 'roulette',
        description: `Código ${code.code} usado por ${code.usedBy.username}`,
        date: code.used_at,
        data: code
      })),
      ...recentAffiliations.map(affiliation => ({
        type: 'affiliation',
        description: `Nuevo cliente ${affiliation.client.username} afiliado`,
        date: affiliation.created_at,
        data: affiliation
      }))
    ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, parseInt(limit));

    res.json({
      success: true,
      activities
    });
  } catch (error) {
    console.error('Error al obtener actividad reciente:', error);
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

    const activeToday = await User.count({
      where: {
        parent_agent_id: req.user.id,
        last_login: { [Op.gte]: today }
      }
    });

    // Bonificaciones pendientes
    const pendingBonuses = await Bonus.count({
      where: {
        assigned_by: req.user.id,
        status: 'pending'
      }
    });

    // Códigos activos
    const activeCodes = await RouletteCode.count({
      where: {
        created_by: req.user.id,
        is_active: true
      }
    });

    // Top 5 clientes (sin balance, por actividad)
    const topClients = await User.findAll({
      where: { parent_agent_id: req.user.id },
      attributes: ['id', 'username', 'profile_data', 'last_login'],
      order: [['last_login', 'DESC']],
      limit: 5
    });

    // Información del afiliado
    const affiliateProfile = await AffiliateProfile.findOne({
      where: { user_id: req.user.id },
      include: [{
        model: AffiliateCode,
        as: 'codes',
        where: { is_active: true },
        required: false
      }]
    });

    res.json({
      success: true,
      dashboard: {
        activeToday,
        pendingBonuses,
        activeCodes,
        topClients,
        affiliateInfo: {
          code: affiliateProfile?.affiliate_code,
          totalReferrals: affiliateProfile?.total_referrals || 0,
          commissionRate: affiliateProfile?.commission_rate || 0,
          activeCodes: affiliateProfile?.codes?.length || 0
        }
      }
    });
  } catch (error) {
    console.error('Error al obtener dashboard:', error);
    res.status(500).json({ 
      message: 'Error al obtener dashboard',
      error: error.message 
    });
  }
};
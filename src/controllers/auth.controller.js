const { User, AffiliateProfile, AffiliationHistory } = require('../models');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

// Generar JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// Generar Refresh Token
const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE
  });
};

// Obtener lista de afiliados disponibles
exports.getAvailableAffiliates = async (req, res) => {
  try {
    const affiliates = await User.findAll({
      where: {
        role: 'agent',
        is_active: true
      },
      attributes: ['id', 'username', 'profile_data'],
      include: [{
        model: AffiliateProfile,
        as: 'affiliateProfile',
        where: { is_active: true },
        attributes: ['affiliate_code', 'custom_url'],
        required: true
      }],
      order: [['username', 'ASC']]
    });

    const formattedAffiliates = affiliates.map(agent => ({
      id: agent.id,
      username: agent.username,
      displayName: `${agent.profile_data.firstName} ${agent.profile_data.lastName}`.trim() || agent.username,
      affiliateCode: agent.affiliateProfile.affiliate_code,
      customUrl: agent.affiliateProfile.custom_url
    }));

    res.json({
      success: true,
      affiliates: formattedAffiliates
    });
  } catch (error) {
    console.error('Error al obtener afiliados:', error);
    res.status(500).json({ 
      message: 'Error al obtener lista de afiliados',
      error: error.message 
    });
  }
};

// Registro con selección de afiliado
exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      username, 
      email, 
      password, 
      affiliateId,    // ID del afiliado seleccionado
      affiliateCode,  // O código de afiliado ingresado
      firstName,
      lastName,
      phone
    } = req.body;

    // Verificar si el usuario existe
    const userExists = await User.findOne({
      where: {
        [Op.or]: [{ email }, { username }]
      }
    });

    if (userExists) {
      return res.status(400).json({ 
        message: 'El usuario o email ya existe' 
      });
    }

    // Determinar el agente padre
    let parentAgentId = null;
    let affiliateCodeUsed = null;
    let bonusAmount = 0;

    // Si se proporcionó un código de afiliado
    if (affiliateCode) {
      const affiliate = await AffiliateProfile.findOne({
        where: { 
          affiliate_code: affiliateCode,
          is_active: true
        },
        include: [{
          model: User,
          as: 'user',
          where: { is_active: true }
        }]
      });

      if (affiliate) {
        parentAgentId = affiliate.user_id;
        affiliateCodeUsed = affiliateCode;
        bonusAmount = parseFloat(process.env.DEFAULT_WELCOME_BONUS) || 50;
      }
    }
    // Si se seleccionó un afiliado del dropdown
    else if (affiliateId) {
      const agent = await User.findOne({
        where: {
          id: affiliateId,
          role: 'agent',
          is_active: true
        }
      });

      if (agent) {
        parentAgentId = agent.id;
        bonusAmount = parseFloat(process.env.DEFAULT_WELCOME_BONUS) || 50;
      }
    }

    // Crear usuario
    const user = await User.create({
      username,
      email,
      password,
      role: 'client',
      parent_agent_id: parentAgentId,
      profile_data: {
        firstName: firstName || '',
        lastName: lastName || '',
        phone: phone || '',
        avatar: null
      },
      balance: bonusAmount // Bonus de bienvenida
    });

    // Registrar en historial de afiliación si tiene agente
    if (parentAgentId) {
      await AffiliationHistory.create({
        client_id: user.id,
        agent_id: parentAgentId,
        affiliate_code_used: affiliateCodeUsed,
        bonus_applied: bonusAmount,
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        referral_source: req.get('referer') || 'direct'
      });

      // Actualizar contador de referidos del afiliado
      await AffiliateProfile.increment('total_referrals', {
        where: { user_id: parentAgentId }
      });
    }

    // Generar tokens
    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    res.status(201).json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        balance: user.balance,
        affiliatedTo: parentAgentId
      }
    });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ 
      message: 'Error al registrar usuario',
      error: error.message 
    });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Buscar usuario
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: username },
          { username }
        ]
      }
    });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ 
        message: 'Credenciales inválidas' 
      });
    }

    // Verificar si está activo
    if (!user.is_active) {
      return res.status(403).json({ 
        message: 'Cuenta desactivada' 
      });
    }

    // Actualizar último login
    user.last_login = new Date();
    await user.save();

    // Generar tokens
    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    res.json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        balance: user.balance,
        profile: user.profile_data
      }
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({ 
      message: 'Error al iniciar sesión',
      error: error.message 
    });
  }
};

// Obtener perfil
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: User,
          as: 'parentAgent',
          attributes: ['id', 'username', 'email', 'profile_data']
        },
        {
          model: AffiliateProfile,
          as: 'affiliateProfile',
          required: false
        }
      ]
    });

    if (!user) {
      return res.status(404).json({ 
        message: 'Usuario no encontrado' 
      });
    }

    res.json({ 
      success: true, 
      user 
    });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ 
      message: 'Error al obtener perfil',
      error: error.message 
    });
  }
};

// Refresh Token
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ 
        message: 'Refresh token requerido' 
      });
    }

    // Verificar refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Generar nuevos tokens
    const newToken = generateToken(decoded.id);
    const newRefreshToken = generateRefreshToken(decoded.id);

    res.json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    return res.status(401).json({ 
      message: 'Refresh token inválido' 
    });
  }
};
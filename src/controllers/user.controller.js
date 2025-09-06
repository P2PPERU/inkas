// src/controllers/user.controller.js
const { User, AffiliateProfile } = require('../models');
const { Op } = require('sequelize');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');

// Obtener perfil del usuario actual
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: User,
          as: 'parentAgent',
          attributes: ['id', 'username', 'email', 'profile_data']
        }
      ]
    });

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

// Actualizar perfil
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;

    const user = await User.findByPk(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        message: 'Usuario no encontrado' 
      });
    }

    user.profile_data = {
      ...user.profile_data,
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(phone !== undefined && { phone })
    };

    await user.save();

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      profile: user.profile_data
    });
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({ 
      message: 'Error al actualizar perfil',
      error: error.message 
    });
  }
};

// Actualizar avatar
exports.updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        message: 'No se proporcionó imagen' 
      });
    }

    const user = await User.findByPk(req.user.id);

    if (user.profile_data.avatar) {
      const oldAvatarPath = path.join(__dirname, '../../', user.profile_data.avatar);
      try {
        await fs.unlink(oldAvatarPath);
      } catch (err) {
        console.error('Error al eliminar avatar anterior:', err);
      }
    }

    user.profile_data = {
      ...user.profile_data,
      avatar: `/uploads/avatars/${req.file.filename}`
    };
    
    await user.save();

    res.json({
      success: true,
      message: 'Avatar actualizado exitosamente',
      avatar: user.profile_data.avatar
    });
  } catch (error) {
    console.error('Error al actualizar avatar:', error);
    res.status(500).json({ 
      message: 'Error al actualizar avatar',
      error: error.message 
    });
  }
};

// Cambiar contraseña
exports.changePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    const user = await User.findByPk(req.user.id);

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ 
        message: 'Contraseña actual incorrecta' 
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ 
      message: 'Error al cambiar contraseña',
      error: error.message 
    });
  }
};

// === FUNCIONES DE ADMINISTRADOR ===

// Obtener todos los usuarios
exports.getAllUsers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      role, 
      status = 'all',
      search 
    } = req.query;
    
    const offset = (page - 1) * limit;
    const whereConditions = {};
    
    if (role) whereConditions.role = role;
    if (status !== 'all') whereConditions.is_active = status === 'active';
    
    if (search) {
      whereConditions[Op.or] = [
        { username: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { 'profile_data.firstName': { [Op.iLike]: `%${search}%` } },
        { 'profile_data.lastName': { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows: users } = await User.findAndCountAll({
      where: whereConditions,
      attributes: { exclude: ['password'] },
      include: [{
        model: User,
        as: 'parentAgent',
        attributes: ['id', 'username'],
        required: false
      }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    res.json({
      success: true,
      users,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalUsers: count
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ 
      message: 'Error al obtener usuarios',
      error: error.message 
    });
  }
};

// Obtener usuario por ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: User,
          as: 'parentAgent',
          attributes: ['id', 'username', 'email']
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
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ 
      message: 'Error al obtener usuario',
      error: error.message 
    });
  }
};

// Crear usuario (Admin)
exports.createUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      username, 
      email, 
      password,
      role,
      parentAgentId,
      firstName,
      lastName,
      phone
    } = req.body;

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

    const user = await User.create({
      username,
      email,
      password,
      role: role || 'client',
      parent_agent_id: parentAgentId || null,
      profile_data: {
        firstName: firstName || '',
        lastName: lastName || '',
        phone: phone || '',
        avatar: null
      }
    });

    if (user.role === 'agent') {
      const affiliateCode = `INKAS${Date.now().toString().slice(-4)}`;
      await AffiliateProfile.create({
        user_id: user.id,
        affiliate_code: affiliateCode,
        commission_rate: parseFloat(process.env.DEFAULT_COMMISSION_RATE) || 10
      });
    }

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ 
      message: 'Error al crear usuario',
      error: error.message 
    });
  }
};

// Actualizar estado del usuario
exports.updateUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ 
        message: 'Usuario no encontrado' 
      });
    }

    if (user.id === req.user.id && !isActive) {
      return res.status(400).json({ 
        message: 'No puedes desactivar tu propia cuenta' 
      });
    }

    user.is_active = isActive;
    await user.save();

    res.json({
      success: true,
      message: `Usuario ${isActive ? 'activado' : 'desactivado'} exitosamente`
    });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ 
      message: 'Error al actualizar estado',
      error: error.message 
    });
  }
};

// Actualizar rol del usuario
exports.updateUserRole = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { role } = req.body;

    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ 
        message: 'Usuario no encontrado' 
      });
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();

    if (oldRole !== 'agent' && role === 'agent') {
      const existingProfile = await AffiliateProfile.findOne({
        where: { user_id: user.id }
      });

      if (!existingProfile) {
        const affiliateCode = `INKAS${Date.now().toString().slice(-4)}`;
        await AffiliateProfile.create({
          user_id: user.id,
          affiliate_code: affiliateCode,
          commission_rate: parseFloat(process.env.DEFAULT_COMMISSION_RATE) || 10
        });
      }
    }

    res.json({
      success: true,
      message: 'Rol actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error al actualizar rol:', error);
    res.status(500).json({ 
      message: 'Error al actualizar rol',
      error: error.message 
    });
  }
};

// Cambiar contraseña de usuario (Admin)
exports.resetUserPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ 
        message: 'La nueva contraseña debe tener al menos 6 caracteres' 
      });
    }

    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ 
        message: 'Usuario no encontrado' 
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Contraseña restablecida exitosamente'
    });
  } catch (error) {
    console.error('Error al restablecer contraseña:', error);
    res.status(500).json({ 
      message: 'Error al restablecer contraseña',
      error: error.message 
    });
  }
};

// Eliminar usuario (soft delete)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ 
        message: 'Usuario no encontrado' 
      });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({ 
        message: 'No puedes eliminar tu propia cuenta' 
      });
    }

    await user.destroy();

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ 
      message: 'Error al eliminar usuario',
      error: error.message 
    });
  }
};

// Obtener estadísticas de usuarios (Admin)
exports.getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { is_active: true } });
    
    const usersByRole = await User.findAll({
      attributes: [
        'role',
        [User.sequelize.fn('COUNT', User.sequelize.col('id')), 'count']
      ],
      group: ['role']
    });

    const recentUsers = await User.findAll({
      where: {
        created_at: {
          [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      },
      attributes: { exclude: ['password'] },
      order: [['created_at', 'DESC']],
      limit: 10
    });

    res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        byRole: usersByRole.map(item => ({
          role: item.role,
          count: parseInt(item.dataValues.count)
        })),
        recentUsers
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
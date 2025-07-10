// src/controllers/user.controller.js
const User = require('../models/User.model');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');

// Obtener perfil del usuario actual
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('parentAgent', 'username email');

    res.json({
      success: true,
      user
    });
  } catch (error) {
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

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        message: 'Usuario no encontrado' 
      });
    }

    // Actualizar campos del perfil
    user.profile = {
      ...user.profile,
      firstName: firstName || user.profile.firstName,
      lastName: lastName || user.profile.lastName,
      phone: phone || user.profile.phone
    };

    await user.save();

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      profile: user.profile
    });
  } catch (error) {
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

    const user = await User.findById(req.user.id);

    // Eliminar avatar anterior si existe
    if (user.profile.avatar) {
      const oldAvatarPath = path.join(__dirname, '../../', user.profile.avatar);
      try {
        await fs.unlink(oldAvatarPath);
      } catch (err) {
        console.error('Error al eliminar avatar anterior:', err);
      }
    }

    // Actualizar con nuevo avatar
    user.profile.avatar = `/uploads/avatars/${req.file.filename}`;
    await user.save();

    res.json({
      success: true,
      message: 'Avatar actualizado exitosamente',
      avatar: user.profile.avatar
    });
  } catch (error) {
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

    const user = await User.findById(req.user.id);

    // Verificar contraseña actual
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ 
        message: 'Contraseña actual incorrecta' 
      });
    }

    // Actualizar contraseña
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al cambiar contraseña',
      error: error.message 
    });
  }
};

// === Funciones de Administrador ===

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

    const filter = {};
    
    if (role) filter.role = role;
    if (status !== 'all') filter.isActive = status === 'active';
    
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'profile.firstName': { $regex: search, $options: 'i' } },
        { 'profile.lastName': { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .populate('parentAgent', 'username')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await User.countDocuments(filter);

    res.json({
      success: true,
      users,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al obtener usuarios',
      error: error.message 
    });
  }
};

// Obtener usuario por ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('parentAgent', 'username email');

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
    res.status(500).json({ 
      message: 'Error al obtener usuario',
      error: error.message 
    });
  }
};

// Actualizar estado del usuario
exports.updateUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ 
        message: 'Usuario no encontrado' 
      });
    }

    user.isActive = isActive;
    await user.save();

    res.json({
      success: true,
      message: `Usuario ${isActive ? 'activado' : 'desactivado'} exitosamente`
    });
  } catch (error) {
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

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ 
        message: 'Usuario no encontrado' 
      });
    }

    user.role = role;
    await user.save();

    res.json({
      success: true,
      message: 'Rol actualizado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al actualizar rol',
      error: error.message 
    });
  }
};

// Eliminar usuario
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ 
        message: 'Usuario no encontrado' 
      });
    }

    // No permitir eliminar el propio usuario
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ 
        message: 'No puedes eliminar tu propia cuenta' 
      });
    }

    await user.deleteOne();

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al eliminar usuario',
      error: error.message 
    });
  }
};
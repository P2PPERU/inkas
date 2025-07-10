const User = require('../models/User.model');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

// Generar JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// Registro
exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, role } = req.body;

    // Verificar si el usuario existe
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ 
        message: 'El usuario o email ya existe' 
      });
    }

    // Crear usuario
    const user = await User.create({
      username,
      email,
      password,
      role: role || 'client'
    });

    // Generar token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
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
      $or: [{ email: username }, { username }] 
    });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ 
        message: 'Credenciales inválidas' 
      });
    }

    // Verificar si está activo
    if (!user.isActive) {
      return res.status(403).json({ 
        message: 'Cuenta desactivada' 
      });
    }

    // Actualizar último login
    user.lastLogin = Date.now();
    await user.save();

    // Generar token
    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al iniciar sesión',
      error: error.message 
    });
  }
};

// Obtener perfil
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al obtener perfil',
      error: error.message 
    });
  }
};
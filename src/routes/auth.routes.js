const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');

// Validaciones
const validateRegister = [
  body('username')
    .trim()
    .isLength({ min: 3 })
    .withMessage('El username debe tener al menos 3 caracteres'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres')
];

const validateLogin = [
  body('username').notEmpty().withMessage('Username o email requerido'),
  body('password').notEmpty().withMessage('Contraseña requerida')
];

// Rutas
router.post('/register', validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);
router.get('/profile', protect, authController.getProfile);

module.exports = router;
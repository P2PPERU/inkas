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
    .withMessage('El username debe tener al menos 3 caracteres')
    .matches(/^[a-z0-9_]+$/)
    .withMessage('Username solo puede contener letras minúsculas, números y guiones bajos'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Nombre debe tener al menos 2 caracteres'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Apellido debe tener al menos 2 caracteres'),
  body('phone')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Teléfono inválido'),
  body('affiliateId')
    .optional()
    .isUUID()
    .withMessage('ID de afiliado inválido'),
  body('affiliateCode')
    .optional()
    .trim()
    .isLength({ min: 3 })
    .withMessage('Código de afiliado inválido')
];

const validateLogin = [
  body('username').notEmpty().withMessage('Username o email requerido'),
  body('password').notEmpty().withMessage('Contraseña requerida')
];

const validateRefreshToken = [
  body('refreshToken').notEmpty().withMessage('Refresh token requerido')
];

// Rutas públicas
router.get('/affiliates', authController.getAvailableAffiliates);
router.post('/register', validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);
router.post('/refresh', validateRefreshToken, authController.refreshToken);

// Rutas protegidas
router.get('/profile', protect, authController.getProfile);

module.exports = router;
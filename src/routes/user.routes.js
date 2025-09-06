// src/routes/user.routes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const userController = require('../controllers/user.controller');
const { protect } = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/roleCheck');
const { uploadAvatar } = require('../config/multer');

// Validaciones
const validateProfile = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('El nombre debe tener al menos 2 caracteres'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('El apellido debe tener al menos 2 caracteres'),
  body('phone')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Teléfono inválido')
];

const validatePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Contraseña actual requerida'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Nueva contraseña debe tener al menos 6 caracteres')
];

const validateCreateUser = [
  body('username')
    .trim()
    .isLength({ min: 3 })
    .withMessage('Username debe tener al menos 3 caracteres')
    .matches(/^[a-z0-9_]+$/)
    .withMessage('Username solo puede contener letras minúsculas, números y guiones bajos'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Contraseña debe tener al menos 6 caracteres'),
  body('role')
    .optional()
    .isIn(['admin', 'agent', 'editor', 'client'])
    .withMessage('Rol inválido')
];

const validateRole = [
  body('role')
    .isIn(['admin', 'agent', 'editor', 'client'])
    .withMessage('Rol inválido')
];

// Rutas protegidas - Usuario autenticado
router.use(protect);

router.get('/profile', userController.getProfile);
router.put('/profile', validateProfile, userController.updateProfile);
router.put('/avatar', uploadAvatar.single('avatar'), userController.updateAvatar);
router.put('/password', validatePassword, userController.changePassword);

// Rutas de administrador
router.use(isAdmin);

router.get('/', userController.getAllUsers);
router.get('/stats', userController.getUserStats);
router.post('/', validateCreateUser, userController.createUser);
router.get('/:id', userController.getUserById);
router.put('/:id/status', userController.updateUserStatus);
router.put('/:id/role', validateRole, userController.updateUserRole);
router.put('/:id/password', userController.resetUserPassword);
router.delete('/:id', userController.deleteUser);

module.exports = router;
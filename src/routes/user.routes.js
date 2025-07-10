// src/routes/user.routes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const userController = require('../controllers/user.controller');
const { protect } = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/roleCheck');
const { uploadAvatar } = require('../config/multer');

// Rutas protegidas - Usuario autenticado
router.use(protect);

// Perfil propio
router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);
router.put('/avatar', uploadAvatar.single('avatar'), userController.updateAvatar);
router.put('/password', [
  body('currentPassword').notEmpty().withMessage('Contraseña actual requerida'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Nueva contraseña debe tener al menos 6 caracteres')
], userController.changePassword);

// Rutas de administrador
router.use(isAdmin);
router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.put('/:id/status', userController.updateUserStatus);
router.put('/:id/role', [
  body('role')
    .isIn(['admin', 'agent', 'editor', 'client'])
    .withMessage('Rol inválido')
], userController.updateUserRole);
router.delete('/:id', userController.deleteUser);

module.exports = router;
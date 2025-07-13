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

const validateBalance = [
  body('balance')
    .isFloat({ min: 0 })
    .withMessage('El balance debe ser un número positivo'),
  body('operation')
    .isIn(['set', 'add', 'subtract'])
    .withMessage('Operación inválida')
];

// Rutas protegidas - Usuario autenticado
router.use(protect);

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Obtener mi perfil
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: Obtiene el perfil del usuario autenticado
 *     responses:
 *       200:
 *         description: Perfil obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.get('/profile', userController.getProfile);

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Actualizar mi perfil
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: Actualiza los datos del perfil del usuario autenticado
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 minLength: 2
 *               lastName:
 *                 type: string
 *                 minLength: 2
 *               phone:
 *                 type: string
 *                 pattern: '^\+?[1-9]\d{1,14}$'
 *     responses:
 *       200:
 *         description: Perfil actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 profile:
 *                   type: object
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Usuario no encontrado
 */
router.put('/profile', validateProfile, userController.updateProfile);

/**
 * @swagger
 * /api/users/avatar:
 *   put:
 *     summary: Actualizar avatar
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: Actualiza la imagen de avatar del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - avatar
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Archivo de imagen (max 2MB)
 *     responses:
 *       200:
 *         description: Avatar actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 avatar:
 *                   type: string
 *                   description: URL del nuevo avatar
 *       400:
 *         description: No se proporcionó imagen o formato inválido
 *       401:
 *         description: No autorizado
 */
router.put('/avatar', uploadAvatar.single('avatar'), userController.updateAvatar);

/**
 * @swagger
 * /api/users/password:
 *   put:
 *     summary: Cambiar contraseña
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: Permite al usuario cambiar su contraseña
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: Contraseña actual
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 description: Nueva contraseña
 *     responses:
 *       200:
 *         description: Contraseña actualizada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Validación fallida
 *       401:
 *         description: Contraseña actual incorrecta
 */
router.put('/password', validatePassword, userController.changePassword);

// Rutas de administrador
router.use(isAdmin);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Obtener todos los usuarios
 *     tags: [Users, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Lista todos los usuarios del sistema (Solo Admin)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Usuarios por página
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, agent, editor, client]
 *         description: Filtrar por rol
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, active, inactive]
 *           default: all
 *         description: Filtrar por estado
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por username, email o nombre
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *                 totalUsers:
 *                   type: integer
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Acceso denegado - Solo administradores
 */
router.get('/', userController.getAllUsers);

/**
 * @swagger
 * /api/users/stats:
 *   get:
 *     summary: Obtener estadísticas de usuarios
 *     tags: [Users, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Obtiene estadísticas generales de usuarios (Solo Admin)
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalUsers:
 *                       type: integer
 *                     activeUsers:
 *                       type: integer
 *                     inactiveUsers:
 *                       type: integer
 *                     byRole:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           role:
 *                             type: string
 *                           count:
 *                             type: integer
 *                     recentUsers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 */
router.get('/stats', userController.getUserStats);

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Crear nuevo usuario
 *     tags: [Users, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Crea un nuevo usuario en el sistema (Solo Admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 pattern: '^[a-z0-9_]+$'
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               role:
 *                 type: string
 *                 enum: [admin, agent, editor, client]
 *                 default: client
 *               parentAgentId:
 *                 type: string
 *                 format: uuid
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               balance:
 *                 type: number
 *                 minimum: 0
 *                 default: 0
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *       400:
 *         description: Datos inválidos o usuario existente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 */
router.post('/', validateCreateUser, userController.createUser);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Obtener usuario por ID
 *     tags: [Users, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Obtiene la información completa de un usuario específico (Solo Admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       404:
 *         description: Usuario no encontrado
 */
router.get('/:id', userController.getUserById);

/**
 * @swagger
 * /api/users/{id}/status:
 *   put:
 *     summary: Actualizar estado del usuario
 *     tags: [Users, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Activa o desactiva un usuario (Solo Admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *                 description: Estado activo/inactivo
 *     responses:
 *       200:
 *         description: Estado actualizado exitosamente
 *       400:
 *         description: No puedes desactivar tu propia cuenta
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       404:
 *         description: Usuario no encontrado
 */
router.put('/:id/status', userController.updateUserStatus);

/**
 * @swagger
 * /api/users/{id}/role:
 *   put:
 *     summary: Actualizar rol del usuario
 *     tags: [Users, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Cambia el rol de un usuario (Solo Admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [admin, agent, editor, client]
 *                 description: Nuevo rol
 *     responses:
 *       200:
 *         description: Rol actualizado exitosamente
 *       400:
 *         description: Rol inválido
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       404:
 *         description: Usuario no encontrado
 */
router.put('/:id/role', validateRole, userController.updateUserRole);

/**
 * @swagger
 * /api/users/{id}/password:
 *   put:
 *     summary: Restablecer contraseña de usuario
 *     tags: [Users, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Restablece la contraseña de un usuario (Solo Admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 description: Nueva contraseña
 *     responses:
 *       200:
 *         description: Contraseña restablecida exitosamente
 *       400:
 *         description: Contraseña inválida
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       404:
 *         description: Usuario no encontrado
 */
router.put('/:id/password', userController.resetUserPassword);

/**
 * @swagger
 * /api/users/{id}/balance:
 *   put:
 *     summary: Actualizar balance del usuario
 *     tags: [Users, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Modifica el balance de un usuario (Solo Admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - balance
 *               - operation
 *             properties:
 *               balance:
 *                 type: number
 *                 minimum: 0
 *                 description: Monto
 *               operation:
 *                 type: string
 *                 enum: [set, add, subtract]
 *                 description: Tipo de operación
 *           examples:
 *             establecer:
 *               summary: Establecer balance específico
 *               value:
 *                 balance: 1000
 *                 operation: set
 *             agregar:
 *               summary: Agregar al balance
 *               value:
 *                 balance: 100
 *                 operation: add
 *             restar:
 *               summary: Restar del balance
 *               value:
 *                 balance: 50
 *                 operation: subtract
 *     responses:
 *       200:
 *         description: Balance actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 newBalance:
 *                   type: number
 *       400:
 *         description: Balance no puede ser negativo
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       404:
 *         description: Usuario no encontrado
 */
router.put('/:id/balance', validateBalance, userController.updateUserBalance);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Eliminar usuario
 *     tags: [Users, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Elimina un usuario del sistema (soft delete) (Solo Admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario eliminado exitosamente
 *       400:
 *         description: No puedes eliminar tu propia cuenta
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       404:
 *         description: Usuario no encontrado
 */
router.delete('/:id', userController.deleteUser);

module.exports = router;
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

/**
 * @swagger
 * /api/auth/affiliates:
 *   get:
 *     summary: Obtener lista de afiliados disponibles
 *     tags: [Auth]
 *     description: Devuelve la lista de agentes activos que pueden recibir afiliaciones
 *     responses:
 *       200:
 *         description: Lista de afiliados obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 affiliates:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       username:
 *                         type: string
 *                       displayName:
 *                         type: string
 *                       affiliateCode:
 *                         type: string
 *                       customUrl:
 *                         type: string
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/affiliates', authController.getAvailableAffiliates);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registro de nuevo usuario
 *     tags: [Auth]
 *     description: Crea una nueva cuenta de usuario con opción de afiliación
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *           examples:
 *             conAfiliado:
 *               summary: Registro con ID de afiliado
 *               value:
 *                 username: "johndoe"
 *                 email: "john@example.com"
 *                 password: "password123"
 *                 firstName: "John"
 *                 lastName: "Doe"
 *                 phone: "+1234567890"
 *                 affiliateId: "123e4567-e89b-12d3-a456-426614174000"
 *             conCodigo:
 *               summary: Registro con código de afiliado
 *               value:
 *                 username: "janedoe"
 *                 email: "jane@example.com"
 *                 password: "password123"
 *                 affiliateCode: "INKAS1234"
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Datos inválidos o usuario existente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error del servidor
 */
router.post('/register', validateRegister, authController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Auth]
 *     description: Autentica un usuario y devuelve tokens de acceso
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           examples:
 *             conEmail:
 *               summary: Login con email
 *               value:
 *                 username: "user@example.com"
 *                 password: "password123"
 *             conUsername:
 *               summary: Login con username
 *               value:
 *                 username: "johndoe"
 *                 password: "password123"
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Credenciales inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Cuenta desactivada
 *       500:
 *         description: Error del servidor
 */
router.post('/login', validateLogin, authController.login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Renovar token de acceso
 *     tags: [Auth]
 *     description: Usa el refresh token para obtener nuevos tokens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token válido
 *     responses:
 *       200:
 *         description: Tokens renovados exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       401:
 *         description: Refresh token inválido o expirado
 */
router.post('/refresh', validateRefreshToken, authController.refreshToken);

// Rutas protegidas

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Obtener perfil del usuario autenticado
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     description: Devuelve el perfil completo del usuario autenticado incluyendo afiliaciones
 *     responses:
 *       200:
 *         description: Perfil del usuario
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
 *         description: No autorizado - Token inválido o faltante
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error del servidor
 */
router.get('/profile', protect, authController.getProfile);

module.exports = router;
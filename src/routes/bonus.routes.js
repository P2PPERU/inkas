const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const bonusController = require('../controllers/bonus.controller');
const { protect } = require('../middlewares/auth.middleware');
const { isAgent, isAdmin } = require('../middlewares/roleCheck');
const { handleValidationErrors } = require('../middlewares/validation.middleware');

// Validaciones
const validateBonus = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Nombre requerido')
    .isLength({ min: 3, max: 100 })
    .withMessage('El nombre debe tener entre 3 y 100 caracteres'),
  body('type')
    .isIn(['welcome', 'deposit', 'referral', 'achievement', 'custom'])
    .withMessage('Tipo de bonus inválido'),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('El monto debe ser un número positivo'),
  body('assignedTo')
    .isUUID()
    .withMessage('ID de usuario inválido'),
  body('percentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('El porcentaje debe estar entre 0 y 100'),
  body('minDeposit')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El depósito mínimo debe ser positivo'),
  body('maxBonus')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El bonus máximo debe ser positivo'),
  body('validUntil')
    .optional()
    .isISO8601()
    .withMessage('Fecha de expiración inválida'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder 500 caracteres'),
  handleValidationErrors
];

const validateStatusUpdate = [
  body('status')
    .isIn(['pending', 'active', 'claimed', 'expired'])
    .withMessage('Estado inválido'),
  handleValidationErrors
];

const validateStatsQuery = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de inicio inválida'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de fin inválida'),
  handleValidationErrors
];

// === RUTAS PÚBLICAS (requieren autenticación) ===
router.use(protect);

/**
 * @swagger
 * /api/bonus/my-bonuses:
 *   get:
 *     summary: Obtener mis bonificaciones
 *     tags: [Bonus]
 *     security:
 *       - bearerAuth: []
 *     description: Lista todas las bonificaciones activas y pendientes del usuario autenticado
 *     responses:
 *       200:
 *         description: Lista de bonificaciones obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 bonuses:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Bonus'
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.get('/my-bonuses', bonusController.getUserBonuses);

/**
 * @swagger
 * /api/bonus/claim/{bonusId}:
 *   post:
 *     summary: Reclamar bonificación
 *     tags: [Bonus]
 *     security:
 *       - bearerAuth: []
 *     description: Reclama una bonificación disponible y la aplica al balance
 *     parameters:
 *       - in: path
 *         name: bonusId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la bonificación
 *     responses:
 *       200:
 *         description: Bonificación reclamada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 previousBalance:
 *                   type: number
 *                   description: Balance anterior
 *                 bonusAmount:
 *                   type: number
 *                   description: Monto del bonus aplicado
 *                 newBalance:
 *                   type: number
 *                   description: Nuevo balance
 *       400:
 *         description: Bonificación expirada o ya reclamada
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Bonificación no encontrada o no disponible
 *       500:
 *         description: Error del servidor
 */
router.post('/claim/:bonusId', bonusController.claimBonus);

// === RUTAS DE AGENTES ===
router.use(isAgent); // A partir de aquí se requiere rol agent o admin

/**
 * @swagger
 * /api/bonus:
 *   post:
 *     summary: Crear bonificación
 *     tags: [Bonus, Agent]
 *     security:
 *       - bearerAuth: []
 *     description: Crea una nueva bonificación (Agentes solo pueden asignar a sus clientes)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - amount
 *               - assignedTo
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               type:
 *                 type: string
 *                 enum: [welcome, deposit, referral, achievement, custom]
 *               amount:
 *                 type: number
 *                 minimum: 0
 *               percentage:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *               minDeposit:
 *                 type: number
 *                 minimum: 0
 *               maxBonus:
 *                 type: number
 *                 minimum: 0
 *               assignedTo:
 *                 type: string
 *                 format: uuid
 *                 description: ID del usuario destinatario
 *               validUntil:
 *                 type: string
 *                 format: date-time
 *                 description: Fecha de expiración
 *           example:
 *             name: "Bono de Bienvenida"
 *             description: "50% hasta $100 en tu primer depósito"
 *             type: "deposit"
 *             amount: 0
 *             percentage: 50
 *             minDeposit: 20
 *             maxBonus: 100
 *             assignedTo: "123e4567-e89b-12d3-a456-426614174000"
 *             validUntil: "2025-02-28T23:59:59Z"
 *     responses:
 *       201:
 *         description: Bonificación creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 bonus:
 *                   $ref: '#/components/schemas/Bonus'
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tienes permiso para asignar bonus a este cliente
 *       404:
 *         description: Usuario destino no encontrado
 */
router.post('/', validateBonus, bonusController.createBonus);

/**
 * @swagger
 * /api/bonus/user/{userId}:
 *   get:
 *     summary: Obtener bonificaciones de un usuario
 *     tags: [Bonus, Agent]
 *     security:
 *       - bearerAuth: []
 *     description: Lista las bonificaciones de un usuario específico (Agentes solo pueden ver las de sus clientes)
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Lista de bonificaciones del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 bonuses:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Bonus'
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tienes permiso para ver los bonos de este usuario
 *       500:
 *         description: Error del servidor
 */
router.get('/user/:userId', bonusController.getUserBonuses);

// === RUTAS DE ADMINISTRADOR ===
router.use(isAdmin); // A partir de aquí solo admin

/**
 * @swagger
 * /api/bonus:
 *   get:
 *     summary: Obtener todas las bonificaciones
 *     tags: [Bonus, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Lista todas las bonificaciones del sistema con filtros opcionales (Solo Admin)
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
 *         description: Bonificaciones por página
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, pending, active, claimed, expired]
 *           default: all
 *         description: Filtrar por estado
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, welcome, deposit, referral, achievement, custom]
 *           default: all
 *         description: Filtrar por tipo
 *       - in: query
 *         name: assignedBy
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por ID del creador
 *     responses:
 *       200:
 *         description: Lista de bonificaciones
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 bonuses:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Bonus'
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *                 totalBonuses:
 *                   type: integer
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 */
router.get('/', bonusController.getAllBonuses);

/**
 * @swagger
 * /api/bonus/{bonusId}/status:
 *   put:
 *     summary: Actualizar estado de bonificación
 *     tags: [Bonus, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Cambia el estado de una bonificación (Solo Admin)
 *     parameters:
 *       - in: path
 *         name: bonusId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la bonificación
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, active, claimed, expired]
 *                 description: Nuevo estado
 *     responses:
 *       200:
 *         description: Estado actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 bonus:
 *                   $ref: '#/components/schemas/Bonus'
 *       400:
 *         description: No se puede cambiar el estado de un bono ya reclamado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       404:
 *         description: Bonificación no encontrada
 */
router.put('/:bonusId/status', validateStatusUpdate, bonusController.updateBonusStatus);

/**
 * @swagger
 * /api/bonus/{bonusId}:
 *   delete:
 *     summary: Eliminar bonificación
 *     tags: [Bonus, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Elimina una bonificación no reclamada (Solo Admin)
 *     parameters:
 *       - in: path
 *         name: bonusId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la bonificación
 *     responses:
 *       200:
 *         description: Bonificación eliminada exitosamente
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
 *         description: No se puede eliminar una bonificación ya reclamada
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       404:
 *         description: Bonificación no encontrada
 */
router.delete('/:bonusId', bonusController.deleteBonus);

/**
 * @swagger
 * /api/bonus/stats:
 *   get:
 *     summary: Obtener estadísticas de bonificaciones
 *     tags: [Bonus, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Obtiene estadísticas detalladas del sistema de bonificaciones (Solo Admin)
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de inicio para el filtro
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de fin para el filtro
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
 *                     byStatus:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           status:
 *                             type: string
 *                           count:
 *                             type: integer
 *                           totalAmount:
 *                             type: number
 *                     byType:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                           count:
 *                             type: integer
 *                           totalAmount:
 *                             type: number
 *                           avgAmount:
 *                             type: number
 *                     topCreators:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           user:
 *                             type: string
 *                           role:
 *                             type: string
 *                           bonusCount:
 *                             type: integer
 *                           totalAssigned:
 *                             type: number
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       500:
 *         description: Error del servidor
 */
router.get('/stats', validateStatsQuery, bonusController.getBonusStats);

module.exports = router;
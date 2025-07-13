// src/routes/agent.routes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const agentController = require('../controllers/agent.controller');
const { protect } = require('../middlewares/auth.middleware');
const { isAgent } = require('../middlewares/roleCheck');

// Validaciones
const validateClient = [
  body('username')
    .trim()
    .isLength({ min: 3 })
    .withMessage('Username debe tener al menos 3 caracteres'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Contraseña debe tener al menos 6 caracteres')
];

// Todas las rutas requieren autenticación y rol de agente
router.use(protect, isAgent);

/**
 * @swagger
 * /api/agents/clients:
 *   get:
 *     summary: Obtener mis clientes
 *     tags: [Agent]
 *     security:
 *       - bearerAuth: []
 *     description: Lista todos los clientes asignados al agente autenticado
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
 *         description: Clientes por página
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, active, inactive]
 *           default: all
 *         description: Filtrar por estado
 *     responses:
 *       200:
 *         description: Lista de clientes obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 clients:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalClients:
 *                       type: integer
 *                     activeClients:
 *                       type: integer
 *                     totalBalance:
 *                       type: number
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Acceso denegado - Solo agentes
 */
router.get('/clients', agentController.getMyClients);

/**
 * @swagger
 * /api/agents/clients:
 *   post:
 *     summary: Crear nuevo cliente
 *     tags: [Agent]
 *     security:
 *       - bearerAuth: []
 *     description: Registra un nuevo cliente asignado al agente
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
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Cliente creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 client:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     profile:
 *                       type: object
 *                     balance:
 *                       type: number
 *       400:
 *         description: Datos inválidos o usuario existente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo agentes
 */
router.post('/clients', validateClient, agentController.createClient);

/**
 * @swagger
 * /api/agents/clients/{clientId}:
 *   put:
 *     summary: Actualizar cliente
 *     tags: [Agent]
 *     security:
 *       - bearerAuth: []
 *     description: Actualiza los datos de un cliente del agente
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del cliente
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Cliente actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 client:
 *                   type: object
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tienes permiso para modificar este cliente
 *       404:
 *         description: Cliente no encontrado
 */
router.put('/clients/:clientId', agentController.updateClient);

/**
 * @swagger
 * /api/agents/clients/{clientId}/bonus:
 *   post:
 *     summary: Asignar bonificación a cliente
 *     tags: [Agent]
 *     security:
 *       - bearerAuth: []
 *     description: Crea y asigna una bonificación a un cliente específico
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del cliente
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Bonus'
 *     responses:
 *       201:
 *         description: Bonificación asignada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 bonus:
 *                   $ref: '#/components/schemas/Bonus'
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tienes permiso para asignar bonus a este cliente
 *       404:
 *         description: Cliente no encontrado
 */
router.post('/clients/:clientId/bonus', agentController.assignBonusToClient);

/**
 * @swagger
 * /api/agents/stats:
 *   get:
 *     summary: Obtener estadísticas del agente
 *     tags: [Agent]
 *     security:
 *       - bearerAuth: []
 *     description: Obtiene estadísticas detalladas del desempeño del agente
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de inicio (ISO 8601)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de fin (ISO 8601)
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
 *                     clients:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         active:
 *                           type: integer
 *                         inactive:
 *                           type: integer
 *                     bonuses:
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
 *                     rouletteCodes:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         used:
 *                           type: integer
 *                         active:
 *                           type: integer
 *                     affiliate:
 *                       type: object
 *                       properties:
 *                         totalReferrals:
 *                           type: integer
 *                         totalEarnings:
 *                           type: number
 *                         commissionRate:
 *                           type: number
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo agentes
 */
router.get('/stats', agentController.getAgentStats);

/**
 * @swagger
 * /api/agents/activity:
 *   get:
 *     summary: Obtener actividad reciente
 *     tags: [Agent]
 *     security:
 *       - bearerAuth: []
 *     description: Lista las actividades recientes relacionadas con el agente
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Número de actividades a mostrar
 *     responses:
 *       200:
 *         description: Actividades obtenidas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 activities:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         enum: [bonus, roulette, affiliation]
 *                       description:
 *                         type: string
 *                       date:
 *                         type: string
 *                         format: date-time
 *                       data:
 *                         type: object
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo agentes
 */
router.get('/activity', agentController.getRecentActivity);

/**
 * @swagger
 * /api/agents/dashboard:
 *   get:
 *     summary: Obtener dashboard del agente
 *     tags: [Agent]
 *     security:
 *       - bearerAuth: []
 *     description: Obtiene datos resumidos para el dashboard del agente
 *     responses:
 *       200:
 *         description: Dashboard obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 dashboard:
 *                   type: object
 *                   properties:
 *                     activeToday:
 *                       type: integer
 *                       description: Clientes activos hoy
 *                     pendingBonuses:
 *                       type: integer
 *                       description: Bonificaciones pendientes
 *                     activeCodes:
 *                       type: integer
 *                       description: Códigos de ruleta activos
 *                     topClients:
 *                       type: array
 *                       description: Top 5 clientes por balance
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           username:
 *                             type: string
 *                           profile_data:
 *                             type: object
 *                           balance:
 *                             type: number
 *                     affiliateInfo:
 *                       type: object
 *                       properties:
 *                         code:
 *                           type: string
 *                         totalReferrals:
 *                           type: integer
 *                         commissionRate:
 *                           type: number
 *                         activeCodes:
 *                           type: integer
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo agentes
 *       500:
 *         description: Error del servidor
 */
router.get('/dashboard', agentController.getAgentDashboard);

module.exports = router;
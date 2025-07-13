const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const affiliateController = require('../controllers/affiliate.controller');
const { protect } = require('../middlewares/auth.middleware');
const { isAgent } = require('../middlewares/roleCheck');

// Validaciones
const validateAffiliateCode = [
  body('description')
    .optional()
    .trim()
    .isLength({ min: 3 })
    .withMessage('La descripción debe tener al menos 3 caracteres'),
  body('bonusAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El monto del bonus debe ser positivo'),
  body('maxUses')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El número máximo de usos debe ser al menos 1'),
  body('expiresIn')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Los días de expiración deben ser al menos 1')
];

// Todas las rutas requieren autenticación y rol de agente
router.use(protect, isAgent);

/**
 * @swagger
 * /api/affiliate/profile:
 *   get:
 *     summary: Obtener perfil de afiliado
 *     tags: [Affiliate]
 *     security:
 *       - bearerAuth: []
 *     description: Obtiene el perfil completo del afiliado incluyendo códigos activos
 *     responses:
 *       200:
 *         description: Perfil de afiliado obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 profile:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     user_id:
 *                       type: string
 *                       format: uuid
 *                     affiliate_code:
 *                       type: string
 *                       description: Código único del afiliado
 *                     commission_rate:
 *                       type: number
 *                       description: Tasa de comisión en porcentaje
 *                     total_referrals:
 *                       type: integer
 *                       description: Total de referidos
 *                     total_earnings:
 *                       type: number
 *                       description: Ganancias totales
 *                     is_active:
 *                       type: boolean
 *                     custom_url:
 *                       type: string
 *                       description: URL personalizada de afiliado
 *                     codes:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           code:
 *                             type: string
 *                           description:
 *                             type: string
 *                           bonus_amount:
 *                             type: number
 *                           usage_count:
 *                             type: integer
 *                           max_uses:
 *                             type: integer
 *                           is_active:
 *                             type: boolean
 *                           expires_at:
 *                             type: string
 *                             format: date-time
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo agentes
 *       404:
 *         description: Perfil de afiliado no encontrado
 */
router.get('/profile', affiliateController.getAffiliateProfile);

/**
 * @swagger
 * /api/affiliate/codes:
 *   get:
 *     summary: Listar códigos de afiliación
 *     tags: [Affiliate]
 *     security:
 *       - bearerAuth: []
 *     description: Lista todos los códigos de afiliación del agente
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
 *         description: Códigos por página
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, active, expired]
 *           default: all
 *         description: Filtrar por estado
 *     responses:
 *       200:
 *         description: Lista de códigos obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 codes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       code:
 *                         type: string
 *                       description:
 *                         type: string
 *                       bonus_amount:
 *                         type: number
 *                       usage_count:
 *                         type: integer
 *                       max_uses:
 *                         type: integer
 *                       is_active:
 *                         type: boolean
 *                       expires_at:
 *                         type: string
 *                         format: date-time
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo agentes
 *       404:
 *         description: No tienes perfil de afiliado
 */
router.get('/codes', affiliateController.getAffiliateCodes);

/**
 * @swagger
 * /api/affiliate/codes:
 *   post:
 *     summary: Crear código de afiliación
 *     tags: [Affiliate]
 *     security:
 *       - bearerAuth: []
 *     description: Crea un nuevo código de afiliación con bonus opcional
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *                 minLength: 3
 *                 description: Descripción del código
 *               bonusAmount:
 *                 type: number
 *                 minimum: 0
 *                 description: Monto del bonus al usar el código
 *               maxUses:
 *                 type: integer
 *                 minimum: 1
 *                 description: Número máximo de usos (null = ilimitado)
 *               expiresIn:
 *                 type: integer
 *                 minimum: 1
 *                 description: Días hasta expiración
 *           example:
 *             description: "Código especial 50% extra"
 *             bonusAmount: 50
 *             maxUses: 100
 *             expiresIn: 30
 *     responses:
 *       201:
 *         description: Código creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 code:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     code:
 *                       type: string
 *                       description: Código generado automáticamente
 *                     description:
 *                       type: string
 *                     bonus_amount:
 *                       type: number
 *                     max_uses:
 *                       type: integer
 *                     expires_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo agentes
 *       404:
 *         description: No tienes perfil de afiliado
 */
router.post('/codes', validateAffiliateCode, affiliateController.createAffiliateCode);

/**
 * @swagger
 * /api/affiliate/codes/{codeId}:
 *   put:
 *     summary: Actualizar código de afiliación
 *     tags: [Affiliate]
 *     security:
 *       - bearerAuth: []
 *     description: Actualiza la descripción o estado de un código de afiliación
 *     parameters:
 *       - in: path
 *         name: codeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del código
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *                 description: Nueva descripción
 *               isActive:
 *                 type: boolean
 *                 description: Estado activo/inactivo
 *     responses:
 *       200:
 *         description: Código actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 code:
 *                   type: object
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo agentes
 *       404:
 *         description: Código no encontrado
 */
router.put('/codes/:codeId', affiliateController.updateAffiliateCode);

/**
 * @swagger
 * /api/affiliate/stats:
 *   get:
 *     summary: Obtener estadísticas de afiliación
 *     tags: [Affiliate]
 *     security:
 *       - bearerAuth: []
 *     description: Obtiene estadísticas detalladas del programa de afiliación
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, all]
 *           default: 30d
 *         description: Período de tiempo para las estadísticas
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
 *                     chart:
 *                       type: array
 *                       description: Datos para gráfico temporal
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                           referrals:
 *                             type: integer
 *                           bonus:
 *                             type: number
 *                     topCodes:
 *                       type: array
 *                       description: Top 5 códigos más usados
 *                       items:
 *                         type: object
 *                         properties:
 *                           code:
 *                             type: string
 *                           usage_count:
 *                             type: integer
 *                           description:
 *                             type: string
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalReferrals:
 *                           type: integer
 *                         totalBonusGiven:
 *                           type: number
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo agentes
 *       500:
 *         description: Error del servidor
 */
router.get('/stats', affiliateController.getAffiliateStats);

/**
 * @swagger
 * /api/affiliate/marketing:
 *   get:
 *     summary: Obtener materiales de marketing
 *     tags: [Affiliate]
 *     security:
 *       - bearerAuth: []
 *     description: Obtiene enlaces, banners y material promocional del afiliado
 *     responses:
 *       200:
 *         description: Materiales obtenidos exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 materials:
 *                   type: object
 *                   properties:
 *                     referralLinks:
 *                       type: object
 *                       properties:
 *                         main:
 *                           type: string
 *                           description: Enlace principal de referido
 *                         custom:
 *                           type: string
 *                           description: URL personalizada
 *                         qrCode:
 *                           type: string
 *                           description: URL del código QR
 *                     banners:
 *                       type: array
 *                       description: Banners disponibles
 *                       items:
 *                         type: object
 *                         properties:
 *                           size:
 *                             type: string
 *                             example: "728x90"
 *                           url:
 *                             type: string
 *                     embedCode:
 *                       type: string
 *                       description: Código HTML para incrustar
 *                     socialMediaTemplates:
 *                       type: array
 *                       description: Plantillas para redes sociales
 *                       items:
 *                         type: object
 *                         properties:
 *                           platform:
 *                             type: string
 *                             enum: [whatsapp, facebook, twitter, instagram]
 *                           message:
 *                             type: string
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo agentes
 *       404:
 *         description: No tienes perfil de afiliado
 *       500:
 *         description: Error del servidor
 */
router.get('/marketing', affiliateController.getMarketingMaterials);

module.exports = router;
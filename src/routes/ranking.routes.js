const express = require('express');
const router = express.Router();
const rankingController = require('../controllers/ranking.controller');
const { protect } = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/roleCheck');
const { uploadExcel } = require('../config/multer');

// === RUTAS PÚBLICAS ===

/**
 * @swagger
 * /api/rankings:
 *   get:
 *     summary: Obtener rankings públicos
 *     tags: [Rankings]
 *     description: Lista los rankings públicos de jugadores con diferentes filtros
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [points, hands_played, tournaments, rake]
 *           default: points
 *         description: Tipo de ranking
 *       - in: query
 *         name: season
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}$'
 *           example: "2025-01"
 *         description: Temporada (YYYY-MM). Por defecto, temporada actual
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [all_time, monthly, weekly, daily]
 *           default: all_time
 *         description: Período de ranking
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
 *           default: 50
 *         description: Jugadores por página
 *     responses:
 *       200:
 *         description: Rankings obtenidos exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 type:
 *                   type: string
 *                   enum: [points, hands_played, tournaments, rake]
 *                 season:
 *                   type: string
 *                   pattern: '^\d{4}-\d{2}$'
 *                 period:
 *                   type: string
 *                   enum: [all_time, monthly, weekly, daily]
 *                 rankings:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Ranking'
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *                 totalPlayers:
 *                   type: integer
 *       400:
 *         description: Tipo de ranking inválido
 *       500:
 *         description: Error del servidor
 */
router.get('/', rankingController.getRankings);

/**
 * @swagger
 * /api/rankings/player/{playerId}:
 *   get:
 *     summary: Obtener ranking de un jugador específico
 *     tags: [Rankings]
 *     description: Obtiene todos los rankings de un jugador. Puede ser UUID para usuarios registrados o nombre para jugadores externos.
 *     parameters:
 *       - in: path
 *         name: playerId
 *         required: true
 *         schema:
 *           type: string
 *         description: UUID del usuario o nombre del jugador externo
 *         examples:
 *           registrado:
 *             value: "123e4567-e89b-12d3-a456-426614174000"
 *             summary: Usuario registrado
 *           externo:
 *             value: "ProPoker2025"
 *             summary: Jugador externo
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, points, hands_played, tournaments, rake]
 *           default: all
 *         description: Filtrar por tipo de ranking
 *     responses:
 *       200:
 *         description: Rankings del jugador obtenidos exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 player:
 *                   oneOf:
 *                     - type: object
 *                       description: Jugador registrado
 *                       properties:
 *                         id:
 *                           type: string
 *                         username:
 *                           type: string
 *                         profile:
 *                           type: object
 *                     - type: object
 *                       description: Jugador externo
 *                       properties:
 *                         name:
 *                           type: string
 *                         email:
 *                           type: string
 *                         isExternal:
 *                           type: boolean
 *                           example: true
 *                 rankings:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                       season:
 *                         type: string
 *                       period:
 *                         type: string
 *                       position:
 *                         type: integer
 *                       points:
 *                         type: integer
 *                       handsPlayed:
 *                         type: integer
 *                       tournamentsPlayed:
 *                         type: integer
 *                       totalRake:
 *                         type: number
 *                       winRate:
 *                         type: number
 *                       history:
 *                         type: array
 *                         items:
 *                           type: object
 *       404:
 *         description: No se encontraron rankings para este jugador
 *       500:
 *         description: Error del servidor
 */
router.get('/player/:playerId', rankingController.getPlayerRanking);

// === RUTAS PROTEGIDAS (ADMIN) ===
router.use(protect, isAdmin);

/**
 * @swagger
 * /api/rankings/all:
 *   get:
 *     summary: Obtener todos los rankings
 *     tags: [Rankings, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Lista todos los rankings incluyendo los ocultos (Solo Admin)
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [points, hands_played, tournaments, rake]
 *           default: points
 *       - in: query
 *         name: season
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}$'
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [all_time, monthly, weekly, daily]
 *           default: all_time
 *       - in: query
 *         name: includeHidden
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Incluir rankings ocultos
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *     responses:
 *       200:
 *         description: Rankings obtenidos exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 rankings:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/Ranking'
 *                       - type: object
 *                         properties:
 *                           displayName:
 *                             type: string
 *                           displayEmail:
 *                             type: string
 *                           updatedBy:
 *                             type: object
 *                             properties:
 *                               username:
 *                                 type: string
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *                 totalRecords:
 *                   type: integer
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 */
router.get('/all', rankingController.getAllRankings);

/**
 * @swagger
 * /api/rankings/player/{playerId}:
 *   put:
 *     summary: Crear o actualizar ranking
 *     tags: [Rankings, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Crea o actualiza el ranking de un jugador. Soporta jugadores registrados y externos. (Solo Admin)
 *     parameters:
 *       - in: path
 *         name: playerId
 *         required: true
 *         schema:
 *           type: string
 *         description: UUID para usuarios registrados o nombre para jugadores externos
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [points, hands_played, tournaments, rake]
 *                 default: points
 *               points:
 *                 type: integer
 *                 minimum: 0
 *               handsPlayed:
 *                 type: integer
 *                 minimum: 0
 *               tournamentsPlayed:
 *                 type: integer
 *                 minimum: 0
 *               totalRake:
 *                 type: number
 *                 minimum: 0
 *               wins:
 *                 type: integer
 *                 minimum: 0
 *               losses:
 *                 type: integer
 *                 minimum: 0
 *               season:
 *                 type: string
 *                 pattern: '^\d{4}-\d{2}$'
 *               period:
 *                 type: string
 *                 enum: [all_time, monthly, weekly, daily]
 *                 default: all_time
 *               isVisible:
 *                 type: boolean
 *                 default: true
 *               externalPlayerName:
 *                 type: string
 *                 description: Nombre del jugador externo
 *               externalPlayerEmail:
 *                 type: string
 *                 format: email
 *                 description: Email del jugador externo
 *           examples:
 *             registrado:
 *               summary: Actualizar jugador registrado
 *               value:
 *                 type: points
 *                 points: 1500
 *                 handsPlayed: 300
 *                 wins: 150
 *                 losses: 150
 *             externo:
 *               summary: Crear jugador externo
 *               value:
 *                 type: points
 *                 points: 2000
 *                 externalPlayerName: "ProPoker2025"
 *                 externalPlayerEmail: "pro@external.com"
 *                 isVisible: true
 *     responses:
 *       200:
 *         description: Ranking actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 ranking:
 *                   $ref: '#/components/schemas/Ranking'
 *       201:
 *         description: Ranking creado exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       500:
 *         description: Error del servidor
 */
router.put('/player/:playerId', rankingController.updateRanking);

/**
 * @swagger
 * /api/rankings/import:
 *   post:
 *     summary: Importar rankings desde Excel
 *     tags: [Rankings, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Importa rankings masivamente desde un archivo Excel. Soporta jugadores registrados y externos. (Solo Admin)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Archivo Excel (.xlsx, .xls) con datos de rankings
 *     responses:
 *       200:
 *         description: Rankings importados exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 summary:
 *                   type: object
 *                   properties:
 *                     created:
 *                       type: integer
 *                       description: Rankings creados
 *                     updated:
 *                       type: integer
 *                       description: Rankings actualizados
 *                     errors:
 *                       type: integer
 *                       description: Filas con errores
 *                     total:
 *                       type: integer
 *                       description: Total de filas procesadas
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       row:
 *                         type: object
 *                         description: Datos de la fila con error
 *                       error:
 *                         type: string
 *                         description: Mensaje de error
 *       400:
 *         description: Archivo inválido o errores de validación
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       500:
 *         description: Error del servidor
 */
router.post('/import', uploadExcel.single('file'), rankingController.importFromExcel);

/**
 * @swagger
 * /api/rankings/{rankingId}/visibility:
 *   put:
 *     summary: Cambiar visibilidad de ranking
 *     tags: [Rankings, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Muestra u oculta un ranking específico (Solo Admin)
 *     parameters:
 *       - in: path
 *         name: rankingId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del ranking
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isVisible
 *             properties:
 *               isVisible:
 *                 type: boolean
 *                 description: true para mostrar, false para ocultar
 *     responses:
 *       200:
 *         description: Visibilidad actualizada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 ranking:
 *                   $ref: '#/components/schemas/Ranking'
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       404:
 *         description: Ranking no encontrado
 */
router.put('/:rankingId/visibility', rankingController.toggleVisibility);

/**
 * @swagger
 * /api/rankings/{rankingId}:
 *   delete:
 *     summary: Eliminar ranking
 *     tags: [Rankings, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Elimina un ranking del sistema (soft delete) (Solo Admin)
 *     parameters:
 *       - in: path
 *         name: rankingId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del ranking
 *     responses:
 *       200:
 *         description: Ranking eliminado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       404:
 *         description: Ranking no encontrado
 */
router.delete('/:rankingId', rankingController.deleteRanking);

/**
 * @swagger
 * /api/rankings/stats:
 *   get:
 *     summary: Obtener estadísticas de rankings
 *     tags: [Rankings, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Obtiene estadísticas detalladas del sistema de rankings (Solo Admin)
 *     parameters:
 *       - in: query
 *         name: season
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}$'
 *         description: Filtrar por temporada
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
 *                     playersByType:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                           players:
 *                             type: integer
 *                     playerDistribution:
 *                       type: object
 *                       properties:
 *                         registered:
 *                           type: integer
 *                         external:
 *                           type: integer
 *                     averages:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                           avgPoints:
 *                             type: number
 *                           avgHands:
 *                             type: number
 *                           avgTournaments:
 *                             type: number
 *                           avgRake:
 *                             type: number
 *                     topPlayers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Ranking'
 *                     recentUpdates:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Ranking'
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 */
router.get('/stats', rankingController.getRankingStats);

/**
 * @swagger
 * /api/rankings/recalculate:
 *   post:
 *     summary: Recalcular posiciones
 *     tags: [Rankings, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Recalcula las posiciones de todos los rankings (Solo Admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [all, points, hands_played, tournaments, rake]
 *                 default: all
 *                 description: Tipo de ranking a recalcular
 *               season:
 *                 type: string
 *                 pattern: '^\d{4}-\d{2}$'
 *                 description: Temporada específica
 *               period:
 *                 type: string
 *                 enum: [all_time, monthly, weekly, daily]
 *                 default: all_time
 *     responses:
 *       200:
 *         description: Posiciones recalculadas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 totalUpdated:
 *                   type: integer
 *                   description: Número de rankings actualizados
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 */
router.post('/recalculate', rankingController.recalculatePositions);

/**
 * @swagger
 * /api/rankings/template:
 *   get:
 *     summary: Descargar plantilla Excel
 *     tags: [Rankings, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Descarga la plantilla Excel para importar rankings (Solo Admin)
 *     responses:
 *       200:
 *         description: Archivo descargado exitosamente
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       500:
 *         description: Error al generar plantilla
 */
router.get('/template', rankingController.downloadTemplate);

/**
 * @swagger
 * /api/rankings/search/players:
 *   get:
 *     summary: Buscar jugadores
 *     tags: [Rankings, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Busca jugadores registrados y externos para autocompletado (Solo Admin)
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Texto de búsqueda (mínimo 2 caracteres)
 *     responses:
 *       200:
 *         description: Resultados de búsqueda
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 results:
 *                   type: object
 *                   properties:
 *                     registered:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           username:
 *                             type: string
 *                           email:
 *                             type: string
 *                     external:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                           external_player_email:
 *                             type: string
 *       400:
 *         description: La búsqueda debe tener al menos 2 caracteres
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 */
router.get('/search/players', rankingController.searchPlayers);

module.exports = router;
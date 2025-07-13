const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const newsController = require('../controllers/news.controller');
const { protect } = require('../middlewares/auth.middleware');
const { isEditor } = require('../middlewares/roleCheck');
const { uploadNews } = require('../config/multer');
const { handleValidationErrors } = require('../middlewares/validation.middleware');

// Validaciones
const validateNews = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('El título es requerido')
    .isLength({ min: 5, max: 200 })
    .withMessage('El título debe tener entre 5 y 200 caracteres'),
  body('content')
    .trim()
    .notEmpty()
    .withMessage('El contenido es requerido')
    .isLength({ min: 50 })
    .withMessage('El contenido debe tener al menos 50 caracteres'),
  body('summary')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('El resumen no puede exceder 500 caracteres'),
  body('category')
    .isIn(['general', 'tournament', 'promotion', 'update'])
    .withMessage('Categoría inválida'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Estado inválido'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Los tags deben ser un array'),
  body('tags.*')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage('Cada tag debe tener entre 2 y 30 caracteres'),
  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured debe ser true o false'),
  handleValidationErrors
];

const validateNewsQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página debe ser un número positivo'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Límite debe estar entre 1 y 50'),
  query('category')
    .optional()
    .isIn(['general', 'tournament', 'promotion', 'update'])
    .withMessage('Categoría inválida'),
  query('status')
    .optional()
    .isIn(['all', 'draft', 'published', 'archived'])
    .withMessage('Estado inválido'),
  query('featured')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('Featured debe ser true o false'),
  query('sortBy')
    .optional()
    .isIn(['published_at', 'created_at', 'views', 'title'])
    .withMessage('Campo de ordenamiento inválido'),
  handleValidationErrors
];

// === RUTAS PÚBLICAS ===

/**
 * @swagger
 * /api/news:
 *   get:
 *     summary: Listar noticias
 *     tags: [News]
 *     description: Obtiene lista de noticias con filtros opcionales. Usuarios no autenticados solo ven noticias publicadas.
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
 *           maximum: 50
 *           default: 10
 *         description: Noticias por página
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [general, tournament, promotion, update]
 *         description: Filtrar por categoría
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, draft, published, archived]
 *           default: published
 *         description: Filtrar por estado (solo editores/admin pueden ver borradores)
 *       - in: query
 *         name: featured
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Filtrar noticias destacadas
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar en título, contenido o resumen
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [published_at, created_at, views, title]
 *           default: published_at
 *         description: Ordenar por campo
 *     responses:
 *       200:
 *         description: Lista de noticias obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 news:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/News'
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *                 totalNews:
 *                   type: integer
 *       400:
 *         description: Parámetros inválidos
 *       500:
 *         description: Error del servidor
 */
router.get('/', validateNewsQuery, newsController.getNews);

/**
 * @swagger
 * /api/news/featured:
 *   get:
 *     summary: Obtener noticias destacadas
 *     tags: [News]
 *     description: Obtiene las noticias marcadas como destacadas
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 5
 *         description: Número de noticias a obtener
 *     responses:
 *       200:
 *         description: Noticias destacadas obtenidas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 news:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/News'
 *       500:
 *         description: Error del servidor
 */
router.get('/featured', newsController.getFeaturedNews);

/**
 * @swagger
 * /api/news/category/{category}:
 *   get:
 *     summary: Obtener noticias por categoría
 *     tags: [News]
 *     description: Lista las noticias de una categoría específica
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *           enum: [general, tournament, promotion, update]
 *         description: Categoría de las noticias
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
 *           maximum: 50
 *           default: 10
 *     responses:
 *       200:
 *         description: Noticias obtenidas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 category:
 *                   type: string
 *                 news:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/News'
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *                 totalNews:
 *                   type: integer
 *       400:
 *         description: Categoría inválida
 *       500:
 *         description: Error del servidor
 */
router.get('/category/:category', newsController.getNewsByCategory);

/**
 * @swagger
 * /api/news/{id}:
 *   get:
 *     summary: Obtener noticia por ID
 *     tags: [News]
 *     description: Obtiene una noticia específica. Si está publicada, incrementa el contador de vistas.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la noticia
 *     responses:
 *       200:
 *         description: Noticia obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 news:
 *                   $ref: '#/components/schemas/News'
 *       403:
 *         description: No tienes permiso para ver esta noticia (borrador)
 *       404:
 *         description: Noticia no encontrada
 *       500:
 *         description: Error del servidor
 */
router.get('/:id', newsController.getNewsById);

// === RUTAS PROTEGIDAS (editor/admin) ===
router.use(protect, isEditor);

/**
 * @swagger
 * /api/news:
 *   post:
 *     summary: Crear noticia
 *     tags: [News, Editor]
 *     security:
 *       - bearerAuth: []
 *     description: Crea una nueva noticia (Solo editores/admin)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *               - category
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 200
 *               content:
 *                 type: string
 *                 minLength: 50
 *                 description: Contenido HTML de la noticia
 *               summary:
 *                 type: string
 *                 maxLength: 500
 *               category:
 *                 type: string
 *                 enum: [general, tournament, promotion, update]
 *               status:
 *                 type: string
 *                 enum: [draft, published]
 *                 default: draft
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array de tags (enviar como JSON string)
 *               featured:
 *                 type: boolean
 *                 default: false
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Imagen de la noticia (max 5MB)
 *     responses:
 *       201:
 *         description: Noticia creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 news:
 *                   $ref: '#/components/schemas/News'
 *       400:
 *         description: Datos inválidos o archivo muy grande
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo editores/admin
 *       500:
 *         description: Error del servidor
 */
router.post('/', uploadNews.single('image'), validateNews, newsController.createNews);

/**
 * @swagger
 * /api/news/{id}:
 *   put:
 *     summary: Actualizar noticia
 *     tags: [News, Editor]
 *     security:
 *       - bearerAuth: []
 *     description: Actualiza una noticia existente. Los editores solo pueden editar sus propias noticias, admin puede editar todas.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la noticia
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 200
 *               content:
 *                 type: string
 *                 minLength: 50
 *               summary:
 *                 type: string
 *                 maxLength: 500
 *               category:
 *                 type: string
 *                 enum: [general, tournament, promotion, update]
 *               status:
 *                 type: string
 *                 enum: [draft, published, archived]
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               featured:
 *                 type: boolean
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Nueva imagen (opcional)
 *     responses:
 *       200:
 *         description: Noticia actualizada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 news:
 *                   $ref: '#/components/schemas/News'
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tienes permiso para editar esta noticia
 *       404:
 *         description: Noticia no encontrada
 *       500:
 *         description: Error del servidor
 */
router.put('/:id', uploadNews.single('image'), validateNews, newsController.updateNews);

/**
 * @swagger
 * /api/news/{id}:
 *   delete:
 *     summary: Eliminar noticia
 *     tags: [News, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Elimina una noticia (Solo administradores)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la noticia
 *     responses:
 *       200:
 *         description: Noticia eliminada exitosamente
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
 *         description: Solo administradores pueden eliminar noticias
 *       404:
 *         description: Noticia no encontrada
 *       500:
 *         description: Error del servidor
 */
router.delete('/:id', newsController.deleteNews);

/**
 * @swagger
 * /api/news/stats/overview:
 *   get:
 *     summary: Obtener estadísticas de noticias
 *     tags: [News, Editor]
 *     security:
 *       - bearerAuth: []
 *     description: Obtiene estadísticas detalladas del sistema de noticias (Solo editores/admin)
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
 *                     byCategory:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           category:
 *                             type: string
 *                           count:
 *                             type: integer
 *                           totalViews:
 *                             type: integer
 *                           avgViews:
 *                             type: number
 *                     topNews:
 *                       type: array
 *                       description: Top 10 noticias más vistas
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           title:
 *                             type: string
 *                           views:
 *                             type: integer
 *                           published_at:
 *                             type: string
 *                             format: date-time
 *                           category:
 *                             type: string
 *                     topAuthors:
 *                       type: array
 *                       description: Top 5 autores más activos
 *                       items:
 *                         type: object
 *                         properties:
 *                           author:
 *                             type: string
 *                           newsCount:
 *                             type: integer
 *                           totalViews:
 *                             type: integer
 *                     newsByMonth:
 *                       type: array
 *                       description: Noticias por mes (últimos 6 meses)
 *                       items:
 *                         type: object
 *                         properties:
 *                           month:
 *                             type: string
 *                             format: date
 *                           count:
 *                             type: integer
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo editores/admin
 *       500:
 *         description: Error del servidor
 */
router.get('/stats/overview', newsController.getNewsStats);

// Middleware de manejo de errores para multer
router.use((error, req, res, next) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'El archivo es demasiado grande. Máximo 5MB.'
    });
  }
  
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Campo de archivo inesperado.'
    });
  }
  
  if (error.message && error.message.includes('Solo se permiten imágenes')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  next(error);
});

module.exports = router;
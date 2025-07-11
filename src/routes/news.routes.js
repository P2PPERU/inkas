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
// Obtener noticias (público ve solo publicadas)
router.get('/', validateNewsQuery, newsController.getNews);

// Obtener noticias destacadas
router.get('/featured', newsController.getFeaturedNews);

// Obtener noticias por categoría
router.get('/category/:category', newsController.getNewsByCategory);

// Obtener noticia por ID (incrementa vistas si está publicada)
router.get('/:id', newsController.getNewsById);

// === RUTAS PROTEGIDAS (editor/admin) ===
router.use(protect, isEditor); // A partir de aquí se requiere autenticación y rol editor/admin

// CRUD de noticias
router.post(
  '/', 
  uploadNews.single('image'), 
  validateNews, 
  newsController.createNews
);

router.put(
  '/:id', 
  uploadNews.single('image'), 
  validateNews, 
  newsController.updateNews
);

router.delete('/:id', newsController.deleteNews);

// Estadísticas (solo para admin/editor)
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
// src/routes/news.routes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const newsController = require('../controllers/news.controller');
const { protect } = require('../middlewares/auth.middleware');
const { isEditor } = require('../middlewares/roleCheck');
const { uploadNews } = require('../config/multer');

// Validaciones
const validateNews = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('El título es requerido')
    .isLength({ max: 200 })
    .withMessage('El título no puede exceder 200 caracteres'),
  body('content')
    .trim()
    .notEmpty()
    .withMessage('El contenido es requerido'),
  body('category')
    .isIn(['general', 'tournament', 'promotion', 'update'])
    .withMessage('Categoría inválida')
];

// Rutas públicas
router.get('/', newsController.getNews);
router.get('/:id', newsController.getNewsById);

// Rutas protegidas (editor/admin)
router.use(protect, isEditor);
router.post('/', uploadNews.single('image'), validateNews, newsController.createNews);
router.put('/:id', uploadNews.single('image'), validateNews, newsController.updateNews);
router.delete('/:id', newsController.deleteNews);
router.get('/stats/overview', newsController.getNewsStats);

module.exports = router;
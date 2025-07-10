const News = require('../models/News.model');
const { validationResult } = require('express-validator');
const fs = require('fs').promises;
const path = require('path');

// Obtener todas las noticias
exports.getNews = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      category, 
      status = 'published',
      sortBy = 'publishedAt' 
    } = req.query;

    const filter = {};
    
    // Filtros públicos solo ven publicadas
    if (req.user?.role === 'client' || !req.user) {
      filter.status = 'published';
    } else if (status !== 'all') {
      filter.status = status;
    }

    if (category) filter.category = category;

    const news = await News.find(filter)
      .populate('author', 'username profile.firstName profile.lastName')
      .sort({ [sortBy]: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await News.countDocuments(filter);

    res.json({
      success: true,
      news,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al obtener noticias',
      error: error.message 
    });
  }
};

// Obtener noticia por ID
exports.getNewsById = async (req, res) => {
  try {
    const news = await News.findById(req.params.id)
      .populate('author', 'username profile.firstName profile.lastName');

    if (!news) {
      return res.status(404).json({ 
        message: 'Noticia no encontrada' 
      });
    }

    // Verificar permisos para ver borradores
    if (news.status !== 'published' && 
        (!req.user || !['admin', 'editor'].includes(req.user.role))) {
      return res.status(403).json({ 
        message: 'No tienes permiso para ver esta noticia' 
      });
    }

    // Incrementar vistas si está publicada
    if (news.status === 'published') {
      news.views += 1;
      await news.save();
    }

    res.json({
      success: true,
      news
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al obtener noticia',
      error: error.message 
    });
  }
};

// Crear noticia
exports.createNews = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, content, summary, category, status } = req.body;

    const newsData = {
      title,
      content,
      summary,
      category,
      author: req.user.id,
      status: status || 'draft'
    };

    // Si hay imagen
    if (req.file) {
      newsData.image = `/uploads/news/${req.file.filename}`;
    }

    // Si se publica directamente
    if (newsData.status === 'published') {
      newsData.publishedAt = Date.now();
    }

    const news = await News.create(newsData);

    res.status(201).json({
      success: true,
      news
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al crear noticia',
      error: error.message 
    });
  }
};

// Actualizar noticia
exports.updateNews = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const news = await News.findById(req.params.id);

    if (!news) {
      return res.status(404).json({ 
        message: 'Noticia no encontrada' 
      });
    }

    // Verificar permisos
    if (req.user.role !== 'admin' && 
        news.author.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'No tienes permiso para editar esta noticia' 
      });
    }

    const { title, content, summary, category, status } = req.body;

    // Actualizar campos
    if (title) news.title = title;
    if (content) news.content = content;
    if (summary) news.summary = summary;
    if (category) news.category = category;

    // Manejar cambio de estado
    if (status && status !== news.status) {
      if (status === 'published' && news.status !== 'published') {
        news.publishedAt = Date.now();
      }
      news.status = status;
    }

    // Si hay nueva imagen
    if (req.file) {
      // Eliminar imagen anterior si existe
      if (news.image) {
        const oldImagePath = path.join(__dirname, '../../', news.image);
        try {
          await fs.unlink(oldImagePath);
        } catch (err) {
          console.error('Error al eliminar imagen anterior:', err);
        }
      }
      news.image = `/uploads/news/${req.file.filename}`;
    }

    await news.save();

    res.json({
      success: true,
      news
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al actualizar noticia',
      error: error.message 
    });
  }
};

// Eliminar noticia
exports.deleteNews = async (req, res) => {
  try {
    const news = await News.findById(req.params.id);

    if (!news) {
      return res.status(404).json({ 
        message: 'Noticia no encontrada' 
      });
    }

    // Verificar permisos
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Solo administradores pueden eliminar noticias' 
      });
    }

    // Eliminar imagen si existe
    if (news.image) {
      const imagePath = path.join(__dirname, '../../', news.image);
      try {
        await fs.unlink(imagePath);
      } catch (err) {
        console.error('Error al eliminar imagen:', err);
      }
    }

    await news.deleteOne();

    res.json({
      success: true,
      message: 'Noticia eliminada exitosamente'
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al eliminar noticia',
      error: error.message 
    });
  }
};

// Obtener estadísticas de noticias (admin)
exports.getNewsStats = async (req, res) => {
  try {
    const stats = await News.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const categoriesStats = await News.aggregate([
      {
        $match: { status: 'published' }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalViews: { $sum: '$views' }
        }
      }
    ]);

    const topNews = await News.find({ status: 'published' })
      .sort({ views: -1 })
      .limit(5)
      .select('title views publishedAt');

    res.json({
      success: true,
      stats: {
        byStatus: stats,
        byCategory: categoriesStats,
        topNews
      }
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al obtener estadísticas',
      error: error.message 
    });
  }
};
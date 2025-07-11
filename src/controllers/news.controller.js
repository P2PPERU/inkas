const { News, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../models').sequelize;
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
      featured,
      search,
      sortBy = 'published_at' 
    } = req.query;

    const offset = (page - 1) * limit;
    const whereConditions = {};
    
    // Filtros públicos solo ven publicadas
    if (!req.user || req.user.role === 'client') {
      whereConditions.status = 'published';
    } else if (status !== 'all') {
      whereConditions.status = status;
    }

    if (category) whereConditions.category = category;
    if (featured !== undefined) whereConditions.featured = featured === 'true';
    
    if (search) {
      whereConditions[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { content: { [Op.iLike]: `%${search}%` } },
        { summary: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows: news } = await News.findAndCountAll({
      where: whereConditions,
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'profile_data']
      }],
      order: [[sortBy, 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    res.json({
      success: true,
      news,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalNews: count
    });
  } catch (error) {
    console.error('Error al obtener noticias:', error);
    res.status(500).json({ 
      message: 'Error al obtener noticias',
      error: error.message 
    });
  }
};

// Obtener noticia por ID
exports.getNewsById = async (req, res) => {
  try {
    const news = await News.findByPk(req.params.id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'profile_data']
      }]
    });

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
      await news.increment('views');
    }

    res.json({
      success: true,
      news
    });
  } catch (error) {
    console.error('Error al obtener noticia:', error);
    res.status(500).json({ 
      message: 'Error al obtener noticia',
      error: error.message 
    });
  }
};

// Crear noticia
exports.createNews = async (req, res) => {
  try {
    const { 
      title, 
      content, 
      summary, 
      category, 
      status,
      tags,
      featured 
    } = req.body;

    const newsData = {
      title,
      content,
      summary,
      category,
      author_id: req.user.id,
      status: status || 'draft',
      tags: tags || [],
      featured: featured || false
    };

    // Si hay imagen
    if (req.file) {
      newsData.image_url = `/uploads/news/${req.file.filename}`;
    }

    // Si se publica directamente
    if (newsData.status === 'published') {
      newsData.published_at = new Date();
    }

    const news = await News.create(newsData);

    // Recargar con autor
    const createdNews = await News.findByPk(news.id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'profile_data']
      }]
    });

    res.status(201).json({
      success: true,
      news: createdNews
    });
  } catch (error) {
    // Si hay error y se subió imagen, eliminarla
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (err) {
        console.error('Error al eliminar imagen:', err);
      }
    }
    
    console.error('Error al crear noticia:', error);
    res.status(500).json({ 
      message: 'Error al crear noticia',
      error: error.message 
    });
  }
};

// Actualizar noticia
exports.updateNews = async (req, res) => {
  try {
    const news = await News.findByPk(req.params.id);

    if (!news) {
      return res.status(404).json({ 
        message: 'Noticia no encontrada' 
      });
    }

    // Verificar permisos
    if (req.user.role !== 'admin' && 
        news.author_id !== req.user.id) {
      return res.status(403).json({ 
        message: 'No tienes permiso para editar esta noticia' 
      });
    }

    const { 
      title, 
      content, 
      summary, 
      category, 
      status,
      tags,
      featured 
    } = req.body;

    // Actualizar campos
    if (title !== undefined) news.title = title;
    if (content !== undefined) news.content = content;
    if (summary !== undefined) news.summary = summary;
    if (category !== undefined) news.category = category;
    if (tags !== undefined) news.tags = tags;
    if (featured !== undefined) news.featured = featured;

    // Manejar cambio de estado
    if (status && status !== news.status) {
      if (status === 'published' && news.status !== 'published') {
        news.published_at = new Date();
      }
      news.status = status;
    }

    // Si hay nueva imagen
    if (req.file) {
      // Eliminar imagen anterior si existe
      if (news.image_url) {
        const oldImagePath = path.join(__dirname, '../..', news.image_url);
        try {
          await fs.unlink(oldImagePath);
        } catch (err) {
          console.error('Error al eliminar imagen anterior:', err);
        }
      }
      news.image_url = `/uploads/news/${req.file.filename}`;
    }

    await news.save();

    // Recargar con autor
    const updatedNews = await News.findByPk(news.id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'profile_data']
      }]
    });

    res.json({
      success: true,
      news: updatedNews
    });
  } catch (error) {
    // Si hay error y se subió imagen nueva, eliminarla
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (err) {
        console.error('Error al eliminar imagen:', err);
      }
    }
    
    console.error('Error al actualizar noticia:', error);
    res.status(500).json({ 
      message: 'Error al actualizar noticia',
      error: error.message 
    });
  }
};

// Eliminar noticia
exports.deleteNews = async (req, res) => {
  try {
    const news = await News.findByPk(req.params.id);

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
    if (news.image_url) {
      const imagePath = path.join(__dirname, '../..', news.image_url);
      try {
        await fs.unlink(imagePath);
      } catch (err) {
        console.error('Error al eliminar imagen:', err);
      }
    }

    // Soft delete
    await news.destroy();

    res.json({
      success: true,
      message: 'Noticia eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar noticia:', error);
    res.status(500).json({ 
      message: 'Error al eliminar noticia',
      error: error.message 
    });
  }
};

// Obtener estadísticas de noticias (admin)
exports.getNewsStats = async (req, res) => {
  try {
    // Estadísticas por estado
    const statsByStatus = await News.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status']
    });

    // Estadísticas por categoría
    const statsByCategory = await News.findAll({
      where: { status: 'published' },
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('views')), 'totalViews'],
        [sequelize.fn('AVG', sequelize.col('views')), 'avgViews']
      ],
      group: ['category']
    });

    // Top noticias más vistas
    const topNews = await News.findAll({
      where: { status: 'published' },
      attributes: ['id', 'title', 'views', 'published_at', 'category'],
      order: [['views', 'DESC']],
      limit: 10
    });

    // Autores más activos
    const topAuthors = await News.findAll({
      attributes: [
        'author_id',
        [sequelize.fn('COUNT', sequelize.col('id')), 'newsCount'],
        [sequelize.fn('SUM', sequelize.col('views')), 'totalViews']
      ],
      include: [{
        model: User,
        as: 'author',
        attributes: ['username', 'profile_data']
      }],
      group: ['author_id', 'author.id'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      limit: 5
    });

    // Noticias por mes (últimos 6 meses)
    const newsByMonth = await News.findAll({
      where: {
        created_at: {
          [Op.gte]: new Date(new Date().setMonth(new Date().getMonth() - 6))
        }
      },
      attributes: [
        [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('created_at')), 'month'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('created_at'))],
      order: [[sequelize.fn('DATE_TRUNC', 'month', sequelize.col('created_at')), 'ASC']]
    });

    res.json({
      success: true,
      stats: {
        byStatus: statsByStatus.map(stat => ({
          status: stat.status,
          count: parseInt(stat.dataValues.count)
        })),
        byCategory: statsByCategory.map(stat => ({
          category: stat.category,
          count: parseInt(stat.dataValues.count),
          totalViews: parseInt(stat.dataValues.totalViews) || 0,
          avgViews: parseFloat(stat.dataValues.avgViews) || 0
        })),
        topNews,
        topAuthors: topAuthors.map(author => ({
          author: author.author.username,
          newsCount: parseInt(author.dataValues.newsCount),
          totalViews: parseInt(author.dataValues.totalViews) || 0
        })),
        newsByMonth: newsByMonth.map(item => ({
          month: item.dataValues.month,
          count: parseInt(item.dataValues.count)
        }))
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ 
      message: 'Error al obtener estadísticas',
      error: error.message 
    });
  }
};

// Obtener noticias destacadas
exports.getFeaturedNews = async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const featuredNews = await News.findAll({
      where: {
        status: 'published',
        featured: true
      },
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'profile_data']
      }],
      order: [['published_at', 'DESC']],
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      news: featuredNews
    });
  } catch (error) {
    console.error('Error al obtener noticias destacadas:', error);
    res.status(500).json({ 
      message: 'Error al obtener noticias destacadas',
      error: error.message 
    });
  }
};

// Obtener noticias por categoría
exports.getNewsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const validCategories = ['general', 'tournament', 'promotion', 'update'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ 
        message: 'Categoría inválida' 
      });
    }

    const { count, rows: news } = await News.findAndCountAll({
      where: {
        category,
        status: 'published'
      },
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'profile_data']
      }],
      order: [['published_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    res.json({
      success: true,
      category,
      news,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalNews: count
    });
  } catch (error) {
    console.error('Error al obtener noticias por categoría:', error);
    res.status(500).json({ 
      message: 'Error al obtener noticias por categoría',
      error: error.message 
    });
  }
};
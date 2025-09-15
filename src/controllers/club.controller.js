const { Club, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../models').sequelize;
const fs = require('fs').promises;
const path = require('path');

// ==================== RUTAS PÚBLICAS ====================

// Obtener clubs públicos (activos)
exports.getPublicClubs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 12, 
      city, 
      type,
      search 
    } = req.query;

    const offset = (page - 1) * limit;
    const whereConditions = {
      is_active: true,
      status: 'active'
    };

    if (city) whereConditions.city = { [Op.iLike]: `%${city}%` };
    if (type) whereConditions.club_type = type;
    
    if (search) {
      whereConditions[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { city: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows: clubs } = await Club.findAndCountAll({
      where: whereConditions,
      attributes: [
        'id', 'name', 'description', 'logo_url', 'banner_url', 'city', 'country',
        'club_type', 'member_count', 'established_date', 'settings'
      ],
      order: [['name', 'ASC']],
      limit: parseInt(limit),
      offset: offset
    });

    res.json({
      success: true,
      clubs,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalClubs: count
    });
  } catch (error) {
    console.error('Error al obtener clubs públicos:', error);
    res.status(500).json({ 
      message: 'Error al obtener clubs',
      error: error.message 
    });
  }
};

// Obtener club público por ID
exports.getPublicClubById = async (req, res) => {
  try {
    const club = await Club.findOne({
      where: {
        id: req.params.id,
        is_active: true,
        status: 'active'
      },
      attributes: [
        'id', 'name', 'description', 'logo_url', 'banner_url', 'address', 'city', 
        'country', 'email', 'website', 'social_media', 'club_type', 
        'member_count', 'established_date', 'settings', 'is_active', 'owner_name', 'owner_phone'
      ]
    });

    if (!club) {
      return res.status(404).json({ 
        message: 'Club no encontrado' 
      });
    }

    res.json({
      success: true,
      club
    });
  } catch (error) {
    console.error('Error al obtener club:', error);
    res.status(500).json({ 
      message: 'Error al obtener club',
      error: error.message 
    });
  }
};

// Obtener clubs destacados
exports.getFeaturedClubs = async (req, res) => {
  try {
    const { limit = 6 } = req.query;

    const clubs = await Club.findAll({
      where: {
        is_active: true,
        status: 'active'
      },
      attributes: [
        'id', 'name', 'description', 'logo_url', 'banner_url', 'city', 'country',
        'club_type', 'member_count', 'established_date', 'settings'
      ],
      order: [['member_count', 'DESC']], 
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      clubs
    });
  } catch (error) {
    console.error('Error al obtener clubs destacados:', error);
    res.status(500).json({ 
      message: 'Error al obtener clubs destacados',
      error: error.message 
    });
  }
};

// Buscar clubs
exports.searchClubs = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({ 
        message: 'La búsqueda debe tener al menos 2 caracteres' 
      });
    }

    const clubs = await Club.searchClubs(query);

    res.json({
      success: true,
      clubs: clubs.map(club => ({
        id: club.id,
        name: club.name,
        city: club.city,
        logo_url: club.logo_url,
        banner_url: club.banner_url,
        club_type: club.club_type
      }))
    });
  } catch (error) {
    console.error('Error al buscar clubs:', error);
    res.status(500).json({ 
      message: 'Error al buscar clubs',
      error: error.message 
    });
  }
};

// ==================== RUTAS DE ADMINISTRADOR ====================

// Obtener todos los clubs (Admin)
exports.getAllClubs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status = 'all',
      type,
      city,
      search 
    } = req.query;

    const offset = (page - 1) * limit;
    const whereConditions = {};
    
    if (status !== 'all') whereConditions.status = status;
    if (type) whereConditions.club_type = type;
    if (city) whereConditions.city = { [Op.iLike]: `%${city}%` };
    
    if (search) {
      whereConditions[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { owner_name: { [Op.iLike]: `%${search}%` } },
        { city: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows: clubs } = await Club.findAndCountAll({
      where: whereConditions,
      include: [{
        model: User,
        as: 'creator',
        attributes: ['id', 'username']
      }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    res.json({
      success: true,
      clubs,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalClubs: count
    });
  } catch (error) {
    console.error('Error al obtener clubs:', error);
    res.status(500).json({ 
      message: 'Error al obtener clubs',
      error: error.message 
    });
  }
};

// ==================== CREAR CLUB (ADMIN) ====================
exports.createClub = async (req, res) => {
  try {
    console.log('📝 Datos recibidos:', req.body);
    console.log('📁 Archivos recibidos:', req.files);

    // Parsear objetos JSON si vienen como strings
    let location, requirements, schedule, socialLinks, features, gameTypes;
    
    try {
      location = req.body.location ? JSON.parse(req.body.location) : {};
    } catch (e) {
      location = {};
    }
    
    try {
      requirements = req.body.requirements ? JSON.parse(req.body.requirements) : {};
    } catch (e) {
      requirements = {};
    }
    
    try {
      schedule = req.body.schedule ? JSON.parse(req.body.schedule) : {};
    } catch (e) {
      schedule = {};
    }
    
    try {
      socialLinks = req.body.socialLinks ? JSON.parse(req.body.socialLinks) : {};
    } catch (e) {
      socialLinks = {};
    }

    // Manejar arrays como JSON
    try {
      features = req.body.features
      ? (typeof req.body.features === 'string' ? JSON.parse(req.body.features) : req.body.features)
      : [];
    } catch (e) {
      features = [];
    }

    try {
      gameTypes = req.body.gameTypes
      ? (typeof req.body.gameTypes === 'string' ? JSON.parse(req.body.gameTypes) : req.body.gameTypes)
      : [];
    } catch (e) {
      gameTypes = [];
    }

    // VALIDACIÓN: Solo el nombre es obligatorio
    if (!req.body.name || req.body.name.trim() === '') {
      return res.status(400).json({
        message: 'El nombre del club es requerido'
      });
    }

    // Construir datos del club - CAMPOS MÍNIMOS
    const clubData = {
      // CAMPOS OBLIGATORIOS
      name: req.body.name.trim(),
      description: req.body.description || 'Descripción del club',
      created_by: req.user.id,
      
      // CAMPOS OPCIONALES CON VALORES POR DEFECTO
      owner_phone: req.body.contactPhone || null,
      owner_name: req.body.ownerName || 'Administrador',
      
      // Ubicación (opcional)
      address: location.address || null,
      city: location.city || null,
      country: location.country || 'Perú',
      
      // Contacto (opcional)
      email: req.body.contactEmail || null,
      website: req.body.website || null,
      
      // Configuración (con valores por defecto)
      social_media: socialLinks,
      club_type: 'poker_room',
      status: 'active',
      is_active: req.body.isActive !== undefined ? req.body.isActive : true,
      
      // Campos por defecto
      established_date: null,
      member_count: 0,
      
      // Guardar datos adicionales en settings si existen
      settings: {
        features: features,
        gameTypes: gameTypes,
        requirements: requirements,
        schedule: schedule,
        shortDescription: req.body.shortDescription || null,
        isFeatured: req.body.isFeatured || false,
        order: req.body.order || 0
      }
    };

    // Manejar archivos subidos
    if (req.file) {
      clubData.logo_url = `/uploads/clubs/${req.file.filename}`;
    }

    // Si hay múltiples archivos
    if (req.files) {
      console.log('📂 Archivos disponibles:', Object.keys(req.files));
      
      if (req.files.logo && req.files.logo[0]) {
        clubData.logo_url = `/uploads/clubs/${req.files.logo[0].filename}`;
        console.log('✅ Logo procesado:', clubData.logo_url);
      }
      
      if (req.files.banner && req.files.banner[0]) {
        clubData.banner_url = `/uploads/clubs/${req.files.banner[0].filename}`;
        console.log('✅ Banner procesado:', clubData.banner_url);
      }
    }

    console.log('🏗️ Datos finales para crear:', {
      name: clubData.name,
      logo_url: clubData.logo_url,
      banner_url: clubData.banner_url
    });

    // Crear el club
    const club = await Club.create(clubData);

    // Recargar con creator
    const createdClub = await Club.findByPk(club.id, {
      include: [{
        model: User,
        as: 'creator',
        attributes: ['id', 'username']
      }]
    });

    console.log('✅ Club creado exitosamente con banner_url:', createdClub.banner_url);

    res.status(201).json({
      success: true,
      club: createdClub,
      message: 'Club creado exitosamente'
    });

  } catch (error) {
    // Limpiar archivos en caso de error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (err) {
        console.error('Error al eliminar archivo:', err);
      }
    }
    
    if (req.files) {
      Object.values(req.files).flat().forEach(async (file) => {
        try {
          await fs.unlink(file.path);
        } catch (err) {
          console.error('Error al eliminar archivo:', err);
        }
      });
    }
    
    console.error('❌ Error al crear club:', error);
    res.status(500).json({ 
      message: 'Error al crear club',
      error: error.message 
    });
  }
};

// Obtener club por ID (Admin)
exports.getClubById = async (req, res) => {
  try {
    const club = await Club.findByPk(req.params.id, {
      include: [{
        model: User,
        as: 'creator',
        attributes: ['id', 'username']
      }]
    });

    if (!club) {
      return res.status(404).json({ 
        message: 'Club no encontrado' 
      });
    }

    res.json({
      success: true,
      club
    });
  } catch (error) {
    console.error('Error al obtener club:', error);
    res.status(500).json({ 
      message: 'Error al obtener club',
      error: error.message 
    });
  }
};

// Actualizar club (Admin)
exports.updateClub = async (req, res) => {
  try {
    const club = await Club.findByPk(req.params.id);

    if (!club) {
      return res.status(404).json({ 
        message: 'Club no encontrado' 
      });
    }

    // Solo actualizar campos que se envían
    const updates = {};
    
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.contactPhone !== undefined) updates.owner_phone = req.body.contactPhone;
    if (req.body.ownerName !== undefined) updates.owner_name = req.body.ownerName;
    if (req.body.contactEmail !== undefined) updates.email = req.body.contactEmail;
    if (req.body.website !== undefined) updates.website = req.body.website;
    if (req.body.isActive !== undefined) updates.is_active = req.body.isActive;
    
    // Manejar ubicación
    if (req.body.location) {
      const location = typeof req.body.location === 'string' 
        ? JSON.parse(req.body.location) 
        : req.body.location;
      
      if (location.address !== undefined) updates.address = location.address;
      if (location.city !== undefined) updates.city = location.city;
      if (location.country !== undefined) updates.country = location.country;
    }

    // Manejar redes sociales
    if (req.body.socialLinks) {
      const socialLinks = typeof req.body.socialLinks === 'string' 
        ? JSON.parse(req.body.socialLinks) 
        : req.body.socialLinks;
      updates.social_media = socialLinks;
    }

    // Manejar archivos
    if (req.files) {
      // Logo
      if (req.files.logo && req.files.logo[0]) {
        if (club.logo_url) {
          const oldLogoPath = path.join(__dirname, '../..', club.logo_url);
          try {
            await fs.unlink(oldLogoPath);
          } catch (err) {
            console.error('Error al eliminar logo anterior:', err);
          }
        }
        updates.logo_url = `/uploads/clubs/${req.files.logo[0].filename}`;
      }
      
      // Banner
      if (req.files.banner && req.files.banner[0]) {
        if (club.banner_url) {
          const oldBannerPath = path.join(__dirname, '../..', club.banner_url);
          try {
            await fs.unlink(oldBannerPath);
          } catch (err) {
            console.error('Error al eliminar banner anterior:', err);
          }
        }
        updates.banner_url = `/uploads/clubs/${req.files.banner[0].filename}`;
      }
    }
    
    // Backwards compatibility
    if (req.file) {
      if (club.logo_url) {
        const oldLogoPath = path.join(__dirname, '../..', club.logo_url);
        try {
          await fs.unlink(oldLogoPath);
        } catch (err) {
          console.error('Error al eliminar logo anterior:', err);
        }
      }
      updates.logo_url = `/uploads/clubs/${req.file.filename}`;
    }

    // Aplicar actualizaciones
    await club.update(updates);

    // Recargar con creator
    const updatedClub = await Club.findByPk(club.id, {
      include: [{
        model: User,
        as: 'creator',
        attributes: ['id', 'username']
      }]
    });

    res.json({
      success: true,
      club: updatedClub,
      message: 'Club actualizado exitosamente'
    });

  } catch (error) {
    // Limpiar archivo en caso de error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (err) {
        console.error('Error al eliminar archivo:', err);
      }
    }
    
    if (req.files) {
      Object.values(req.files).flat().forEach(async (file) => {
        try {
          await fs.unlink(file.path);
        } catch (err) {
          console.error('Error al eliminar archivo:', err);
        }
      });
    }
    
    console.error('Error al actualizar club:', error);
    res.status(500).json({ 
      message: 'Error al actualizar club',
      error: error.message 
    });
  }
};

// Cambiar estado del club (Admin)
exports.updateClubStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    
    const club = await Club.findByPk(req.params.id);

    if (!club) {
      return res.status(404).json({ 
        message: 'Club no encontrado' 
      });
    }

    club.is_active = isActive;
    await club.save();

    res.json({
      success: true,
      message: `Club ${isActive ? 'activado' : 'desactivado'} exitosamente`,
      club
    });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ 
      message: 'Error al actualizar estado',
      error: error.message 
    });
  }
};

// Eliminar club (Admin)
exports.deleteClub = async (req, res) => {
  try {
    const club = await Club.findByPk(req.params.id);

    if (!club) {
      return res.status(404).json({ 
        message: 'Club no encontrado' 
      });
    }

    // Eliminar archivos asociados
    if (club.logo_url) {
      const logoPath = path.join(__dirname, '../..', club.logo_url);
      try {
        await fs.unlink(logoPath);
      } catch (err) {
        console.error('Error al eliminar logo:', err);
      }
    }
    
    if (club.banner_url) {
      const bannerPath = path.join(__dirname, '../..', club.banner_url);
      try {
        await fs.unlink(bannerPath);
      } catch (err) {
        console.error('Error al eliminar banner:', err);
      }
    }

    // Soft delete
    await club.destroy();

    res.json({
      success: true,
      message: 'Club eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar club:', error);
    res.status(500).json({ 
      message: 'Error al eliminar club',
      error: error.message 
    });
  }
};

// Obtener estadísticas de clubs (Admin)
exports.getClubStats = async (req, res) => {
  try {
    // Estadísticas por estado
    const statsByStatus = await Club.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status']
    });

    // Estadísticas por tipo
    const statsByType = await Club.findAll({
      where: { is_active: true },
      attributes: [
        'club_type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('AVG', sequelize.col('member_count')), 'avgMembers']
      ],
      group: ['club_type']
    });

    // Clubs por ciudad
    const statsByCity = await Club.findAll({
      where: { is_active: true },
      attributes: [
        'city',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['city'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      limit: 10
    });

    // Clubs más grandes
    const topClubsByMembers = await Club.findAll({
      where: { is_active: true },
      attributes: ['id', 'name', 'city', 'member_count', 'club_type'],
      order: [['member_count', 'DESC']],
      limit: 10
    });

    const totalClubs = await Club.count();
    const activeClubs = await Club.count({ where: { is_active: true, status: 'active' } });

    res.json({
      success: true,
      stats: {
        totalClubs,
        activeClubs,
        featuredClubs: 0,
        totalMembers: topClubsByMembers.reduce((sum, club) => sum + (club.member_count || 0), 0),
        byStatus: statsByStatus.map(stat => ({
          status: stat.status,
          count: parseInt(stat.dataValues.count)
        })),
        byType: statsByType.map(stat => ({
          type: stat.club_type,
          count: parseInt(stat.dataValues.count),
          avgMembers: parseFloat(stat.dataValues.avgMembers) || 0
        })),
        byCity: statsByCity.map(stat => ({
          city: stat.city || 'Sin especificar',
          count: parseInt(stat.dataValues.count)
        })),
        topClubs: topClubsByMembers.map(club => ({
          id: club.id,
          name: club.name,
          members: club.member_count || 0
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
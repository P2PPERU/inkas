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
        'id', 'name', 'description', 'logo_url', 'city', 'country',
        'club_type', 'member_count', 'established_date'
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
        'id', 'name', 'description', 'logo_url', 'address', 'city', 
        'country', 'email', 'website', 'social_media', 'club_type', 
        'member_count', 'established_date'
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

// Crear club (Admin)
exports.createClub = async (req, res) => {
  try {
    const {
      name,
      description,
      ownerPhone,
      ownerName,
      address,
      city,
      country,
      email,
      website,
      socialMedia,
      clubType,
      establishedDate,
      memberCount
    } = req.body;

    const clubData = {
      name,
      description,
      owner_phone: ownerPhone,
      owner_name: ownerName,
      address,
      city,
      country: country || 'Perú',
      email,
      website,
      social_media: socialMedia || {},
      club_type: clubType || 'poker_room',
      established_date: establishedDate,
      member_count: memberCount || 0,
      created_by: req.user.id
    };

    // Si hay logo
    if (req.file) {
      clubData.logo_url = `/uploads/clubs/${req.file.filename}`;
    }

    const club = await Club.create(clubData);

    // Recargar con creator
    const createdClub = await Club.findByPk(club.id, {
      include: [{
        model: User,
        as: 'creator',
        attributes: ['id', 'username']
      }]
    });

    res.status(201).json({
      success: true,
      club: createdClub
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
    
    console.error('Error al crear club:', error);
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

    const {
      name,
      description,
      ownerPhone,
      ownerName,
      address,
      city,
      country,
      email,
      website,
      socialMedia,
      clubType,
      establishedDate,
      memberCount,
      status,
      isActive
    } = req.body;

    // Actualizar campos
    if (name !== undefined) club.name = name;
    if (description !== undefined) club.description = description;
    if (ownerPhone !== undefined) club.owner_phone = ownerPhone;
    if (ownerName !== undefined) club.owner_name = ownerName;
    if (address !== undefined) club.address = address;
    if (city !== undefined) club.city = city;
    if (country !== undefined) club.country = country;
    if (email !== undefined) club.email = email;
    if (website !== undefined) club.website = website;
    if (socialMedia !== undefined) club.social_media = socialMedia;
    if (clubType !== undefined) club.club_type = clubType;
    if (establishedDate !== undefined) club.established_date = establishedDate;
    if (memberCount !== undefined) club.member_count = memberCount;
    if (status !== undefined) club.status = status;
    if (typeof isActive === 'boolean') club.is_active = isActive;

    // Si hay nuevo logo
    if (req.file) {
      // Eliminar logo anterior si existe
      if (club.logo_url) {
        const oldLogoPath = path.join(__dirname, '../..', club.logo_url);
        try {
          await fs.unlink(oldLogoPath);
        } catch (err) {
          console.error('Error al eliminar logo anterior:', err);
        }
      }
      club.logo_url = `/uploads/clubs/${req.file.filename}`;
    }

    await club.save();

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
      club: updatedClub
    });
  } catch (error) {
    // Si hay error y se subió nuevo logo, eliminarlo
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (err) {
        console.error('Error al eliminar imagen:', err);
      }
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
    const { status } = req.body;
    
    const club = await Club.findByPk(req.params.id);

    if (!club) {
      return res.status(404).json({ 
        message: 'Club no encontrado' 
      });
    }

    club.status = status;
    await club.save();

    res.json({
      success: true,
      message: `Club ${status === 'active' ? 'activado' : 'desactivado'} exitosamente`
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

    // Eliminar logo si existe
    if (club.logo_url) {
      const logoPath = path.join(__dirname, '../..', club.logo_url);
      try {
        await fs.unlink(logoPath);
      } catch (err) {
        console.error('Error al eliminar logo:', err);
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

    // Clubs por mes (últimos 6 meses)
    const clubsByMonth = await Club.findAll({
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

    const totalClubs = await Club.count();
    const activeClubs = await Club.count({ where: { is_active: true, status: 'active' } });

    res.json({
      success: true,
      stats: {
        overview: {
          total: totalClubs,
          active: activeClubs,
          inactive: totalClubs - activeClubs
        },
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
        topClubs: topClubsByMembers,
        clubsByMonth: clubsByMonth.map(item => ({
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
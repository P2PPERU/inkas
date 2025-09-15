// src/controllers/rankingGroup.controller.js
const { RankingGroup, Ranking, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../models').sequelize;

// === RUTAS PÚBLICAS ===

// Obtener grupos de rankings públicos
exports.getRankingGroups = async (req, res) => {
  try {
    const { 
      active = true,
      type,
      page = 1,
      limit = 20
    } = req.query;

    const offset = (page - 1) * limit;
    const whereConditions = {
      is_visible: true
    };

    if (active === 'true') {
      const now = new Date();
      whereConditions.is_active = true;
      whereConditions.start_date = { [Op.lte]: now };
      whereConditions.end_date = { [Op.gte]: now };
    }

    if (type && type !== 'all') {
      whereConditions.ranking_type = type;
    }

    const { count, rows: groups } = await RankingGroup.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username']
        },
        {
          model: Ranking,
          as: 'rankings',
          where: { is_visible: true },
          required: false,
          include: [
            {
              model: User,
              as: 'player',
              attributes: ['id', 'username', 'profile_data'],
              required: false
            }
          ],
          limit: 10, // Solo mostrar top 10 en la lista
          order: [
            [sequelize.literal(`CASE 
              WHEN "Ranking"."ranking_type" = 'points' THEN "Ranking"."points"
              WHEN "Ranking"."ranking_type" = 'hands_played' THEN "Ranking"."hands_played"
              WHEN "Ranking"."ranking_type" = 'tournaments' THEN "Ranking"."tournaments_played"
              WHEN "Ranking"."ranking_type" = 'rake' THEN "Ranking"."total_rake"
              ELSE "Ranking"."points"
            END`), 'DESC']
          ]
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset,
      distinct: true
    });

    // Agregar información adicional a cada grupo
    const groupsWithStats = groups.map(group => {
      const groupData = group.toJSON();
      groupData.playerCount = group.rankings.length;
      groupData.isActive = new Date() >= group.start_date && new Date() <= group.end_date;
      groupData.status = groupData.isActive ? 'active' : 
                        new Date() > group.end_date ? 'finished' : 'upcoming';
      
      return groupData;
    });

    res.json({
      success: true,
      groups: groupsWithStats,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalGroups: count
    });
  } catch (error) {
    console.error('Error al obtener grupos de rankings:', error);
    res.status(500).json({ 
      message: 'Error al obtener grupos de rankings',
      error: error.message 
    });
  }
};

// Obtener un grupo específico con sus rankings
exports.getRankingGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const offset = (page - 1) * limit;

    const group = await RankingGroup.findByPk(groupId, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username']
        }
      ]
    });

    if (!group || !group.is_visible) {
      return res.status(404).json({ 
        message: 'Grupo de ranking no encontrado' 
      });
    }

    // Obtener rankings del grupo con paginación
    const { count, rows: rankings } = await Ranking.findAndCountAll({
      where: {
        ranking_group_id: groupId,
        is_visible: true
      },
      include: [
        {
          model: User,
          as: 'player',
          attributes: ['id', 'username', 'profile_data'],
          required: false
        }
      ],
      order: [
        [sequelize.literal(`CASE 
          WHEN '${group.ranking_type}' = 'points' THEN points
          WHEN '${group.ranking_type}' = 'hands_played' THEN hands_played
          WHEN '${group.ranking_type}' = 'tournaments' THEN tournaments_played
          WHEN '${group.ranking_type}' = 'rake' THEN total_rake
          ELSE points
        END`), 'DESC']
      ],
      limit: parseInt(limit),
      offset: offset
    });

    // Agregar posiciones y nombres de display
    rankings.forEach((ranking, index) => {
      ranking.dataValues.position = offset + index + 1;
      ranking.dataValues.displayName = ranking.player 
        ? ranking.player.username 
        : ranking.external_player_name;
    });

    // Información adicional del grupo
    const groupData = group.toJSON();
    groupData.isActive = new Date() >= group.start_date && new Date() <= group.end_date;
    groupData.status = groupData.isActive ? 'active' : 
                      new Date() > group.end_date ? 'finished' : 'upcoming';
    groupData.totalPlayers = count;

    res.json({
      success: true,
      group: groupData,
      rankings,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalPlayers: count
    });
  } catch (error) {
    console.error('Error al obtener grupo de ranking:', error);
    res.status(500).json({ 
      message: 'Error al obtener grupo de ranking',
      error: error.message 
    });
  }
};

// === RUTAS PROTEGIDAS (ADMIN) ===

// Obtener todos los grupos (incluye ocultos)
exports.getAllRankingGroups = async (req, res) => {
  try {
    const { 
      includeHidden = true,
      type,
      status,
      page = 1,
      limit = 20
    } = req.query;

    const offset = (page - 1) * limit;
    const whereConditions = {};

    if (!includeHidden) {
      whereConditions.is_visible = true;
    }

    if (type && type !== 'all') {
      whereConditions.ranking_type = type;
    }

    if (status && status !== 'all') {
      const now = new Date();
      switch (status) {
        case 'active':
          whereConditions.start_date = { [Op.lte]: now };
          whereConditions.end_date = { [Op.gte]: now };
          whereConditions.is_active = true;
          break;
        case 'upcoming':
          whereConditions.start_date = { [Op.gt]: now };
          break;
        case 'finished':
          whereConditions.end_date = { [Op.lt]: now };
          break;
      }
    }

    const { count, rows: groups } = await RankingGroup.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'updatedBy',
          attributes: ['id', 'username'],
          required: false
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    // Agregar estadísticas a cada grupo
    const groupsWithStats = await Promise.all(groups.map(async (group) => {
      const playerCount = await Ranking.count({
        where: { ranking_group_id: group.id }
      });
      
      const groupData = group.toJSON();
      groupData.playerCount = playerCount;
      groupData.isActive = new Date() >= group.start_date && new Date() <= group.end_date;
      groupData.status = groupData.isActive ? 'active' : 
                        new Date() > group.end_date ? 'finished' : 'upcoming';
      
      return groupData;
    }));

    res.json({
      success: true,
      groups: groupsWithStats,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalGroups: count
    });
  } catch (error) {
    console.error('Error al obtener todos los grupos:', error);
    res.status(500).json({ 
      message: 'Error al obtener grupos de rankings',
      error: error.message 
    });
  }
};

// Crear nuevo grupo de ranking
exports.createRankingGroup = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const {
      name,
      description,
      ranking_type,
      start_date,
      end_date,
      is_active = true,
      is_visible = true,
      settings = {}
    } = req.body;

    // Validaciones básicas
    if (!name || !ranking_type || !start_date || !end_date) {
      return res.status(400).json({
        message: 'Nombre, tipo de ranking, fecha de inicio y fecha de fin son requeridos'
      });
    }

    // Validar fechas
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    
    if (startDate >= endDate) {
      return res.status(400).json({
        message: 'La fecha de fin debe ser posterior a la fecha de inicio'
      });
    }

    // Verificar que el nombre no exista
    const existingGroup = await RankingGroup.findOne({
      where: { name },
      transaction: t
    });

    if (existingGroup) {
      return res.status(400).json({
        message: 'Ya existe un grupo de ranking con este nombre'
      });
    }

    // Crear el grupo
    const group = await RankingGroup.create({
      name,
      description,
      ranking_type,
      start_date: startDate,
      end_date: endDate,
      is_active,
      is_visible,
      settings,
      created_by: req.user.id
    }, { transaction: t });

    await t.commit();

    // Obtener el grupo creado con las relaciones
    const createdGroup = await RankingGroup.findByPk(group.id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username']
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Grupo de ranking creado exitosamente',
      group: createdGroup
    });
  } catch (error) {
    await t.rollback();
    console.error('Error al crear grupo de ranking:', error);
    res.status(500).json({ 
      message: 'Error al crear grupo de ranking',
      error: error.message 
    });
  }
};

// Actualizar grupo de ranking
exports.updateRankingGroup = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { groupId } = req.params;
    const {
      name,
      description,
      ranking_type,
      start_date,
      end_date,
      is_active,
      is_visible,
      settings
    } = req.body;

    const group = await RankingGroup.findByPk(groupId, { transaction: t });
    
    if (!group) {
      return res.status(404).json({ 
        message: 'Grupo de ranking no encontrado' 
      });
    }

    // Validar cambio de nombre si se proporciona
    if (name && name !== group.name) {
      const existingGroup = await RankingGroup.findOne({
        where: { 
          name,
          id: { [Op.ne]: groupId }
        },
        transaction: t
      });

      if (existingGroup) {
        return res.status(400).json({
          message: 'Ya existe un grupo de ranking con este nombre'
        });
      }
    }

    // Validar fechas si se proporcionan
    if (start_date && end_date) {
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      
      if (startDate >= endDate) {
        return res.status(400).json({
          message: 'La fecha de fin debe ser posterior a la fecha de inicio'
        });
      }
    }

    // Actualizar campos
    const updateData = {
      last_updated_by: req.user.id
    };

    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (ranking_type) updateData.ranking_type = ranking_type;
    if (start_date) updateData.start_date = new Date(start_date);
    if (end_date) updateData.end_date = new Date(end_date);
    if (is_active !== undefined) updateData.is_active = is_active;
    if (is_visible !== undefined) updateData.is_visible = is_visible;
    if (settings) updateData.settings = settings;

    await group.update(updateData, { transaction: t });

    // Si cambió el tipo de ranking, recalcular posiciones
    if (ranking_type && ranking_type !== group.ranking_type) {
      await Ranking.updatePositions(groupId);
    }

    await t.commit();

    // Obtener el grupo actualizado
    const updatedGroup = await RankingGroup.findByPk(groupId, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'updatedBy',
          attributes: ['id', 'username']
        }
      ]
    });

    res.json({
      success: true,
      message: 'Grupo de ranking actualizado exitosamente',
      group: updatedGroup
    });
  } catch (error) {
    await t.rollback();
    console.error('Error al actualizar grupo de ranking:', error);
    res.status(500).json({ 
      message: 'Error al actualizar grupo de ranking',
      error: error.message 
    });
  }
};

// Eliminar grupo de ranking
exports.deleteRankingGroup = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { groupId } = req.params;

    const group = await RankingGroup.findByPk(groupId, { transaction: t });
    
    if (!group) {
      return res.status(404).json({ 
        message: 'Grupo de ranking no encontrado' 
      });
    }

    // Verificar si tiene rankings asociados
    const rankingCount = await Ranking.count({
      where: { ranking_group_id: groupId },
      transaction: t
    });

    if (rankingCount > 0) {
      return res.status(400).json({
        message: `No se puede eliminar el grupo. Tiene ${rankingCount} rankings asociados. Elimine primero los rankings o use eliminación forzada.`
      });
    }

    // Soft delete
    await group.destroy({ transaction: t });

    await t.commit();

    res.json({
      success: true,
      message: 'Grupo de ranking eliminado exitosamente'
    });
  } catch (error) {
    await t.rollback();
    console.error('Error al eliminar grupo de ranking:', error);
    res.status(500).json({ 
      message: 'Error al eliminar grupo de ranking',
      error: error.message 
    });
  }
};

// Forzar eliminación (incluye rankings)
exports.forceDeleteRankingGroup = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { groupId } = req.params;

    const group = await RankingGroup.findByPk(groupId, { transaction: t });
    
    if (!group) {
      return res.status(404).json({ 
        message: 'Grupo de ranking no encontrado' 
      });
    }

    // Eliminar todos los rankings del grupo
    await Ranking.destroy({
      where: { ranking_group_id: groupId },
      transaction: t
    });

    // Eliminar el grupo
    await group.destroy({ transaction: t });

    await t.commit();

    res.json({
      success: true,
      message: 'Grupo de ranking y todos sus rankings eliminados exitosamente'
    });
  } catch (error) {
    await t.rollback();
    console.error('Error al eliminar grupo forzadamente:', error);
    res.status(500).json({ 
      message: 'Error al eliminar grupo de ranking',
      error: error.message 
    });
  }
};

// Duplicar grupo de ranking
exports.duplicateRankingGroup = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { groupId } = req.params;
    const { 
      name,
      start_date,
      end_date,
      copy_rankings = false 
    } = req.body;

    const originalGroup = await RankingGroup.findByPk(groupId, {
      include: [
        {
          model: Ranking,
          as: 'rankings'
        }
      ],
      transaction: t
    });
    
    if (!originalGroup) {
      return res.status(404).json({ 
        message: 'Grupo de ranking no encontrado' 
      });
    }

    // Crear el nuevo grupo
    const newGroup = await RankingGroup.create({
      name: name || `${originalGroup.name} - Copia`,
      description: originalGroup.description,
      ranking_type: originalGroup.ranking_type,
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      is_active: true,
      is_visible: true,
      settings: originalGroup.settings,
      created_by: req.user.id
    }, { transaction: t });

    // Copiar rankings si se solicita
    if (copy_rankings && originalGroup.rankings.length > 0) {
      const newRankings = originalGroup.rankings.map(ranking => ({
        ranking_group_id: newGroup.id,
        player_id: ranking.player_id,
        external_player_name: ranking.external_player_name,
        external_player_email: ranking.external_player_email,
        is_external: ranking.is_external,
        points: ranking.points,
        games_played: ranking.games_played,
        hands_played: ranking.hands_played,
        tournaments_played: ranking.tournaments_played,
        total_rake: ranking.total_rake,
        wins: ranking.wins,
        losses: ranking.losses,
        win_rate: ranking.win_rate,
        is_visible: ranking.is_visible,
        last_updated_by: req.user.id
      }));

      await Ranking.bulkCreate(newRankings, { transaction: t });
      
      // Recalcular posiciones
      await Ranking.updatePositions(newGroup.id);
    }

    await t.commit();

    // Obtener el grupo creado con las relaciones
    const createdGroup = await RankingGroup.findByPk(newGroup.id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username']
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Grupo de ranking duplicado exitosamente',
      group: createdGroup
    });
  } catch (error) {
    await t.rollback();
    console.error('Error al duplicar grupo de ranking:', error);
    res.status(500).json({ 
      message: 'Error al duplicar grupo de ranking',
      error: error.message 
    });
  }
};
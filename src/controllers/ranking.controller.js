// src/controllers/ranking.controller.js - Versión actualizada
const { Ranking, RankingGroup, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../models').sequelize;
const excelService = require('../services/excel.service');
const fs = require('fs').promises;

// Obtener rankings de un grupo específico
exports.getRankingsByGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const offset = (page - 1) * limit;

    // Verificar que el grupo existe y es visible
    const group = await RankingGroup.findOne({
      where: {
        id: groupId,
        is_visible: true
      }
    });

    if (!group) {
      return res.status(404).json({ 
        message: 'Grupo de ranking no encontrado' 
      });
    }

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
        },
        {
          model: RankingGroup,
          as: 'rankingGroup',
          attributes: ['id', 'name', 'ranking_type', 'start_date', 'end_date']
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

    // Actualizar posiciones y agregar nombre para mostrar
    rankings.forEach((ranking, index) => {
      ranking.dataValues.position = offset + index + 1;
      ranking.dataValues.displayName = ranking.player 
        ? ranking.player.username 
        : ranking.external_player_name;
      ranking.dataValues.displayEmail = ranking.player 
        ? ranking.player.email 
        : ranking.external_player_email;
    });

    res.json({
      success: true,
      group: {
        id: group.id,
        name: group.name,
        type: group.ranking_type,
        startDate: group.start_date,
        endDate: group.end_date,
        isActive: new Date() >= group.start_date && new Date() <= group.end_date
      },
      rankings,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalPlayers: count
    });
  } catch (error) {
    console.error('Error al obtener rankings por grupo:', error);
    res.status(500).json({ 
      message: 'Error al obtener rankings',
      error: error.message 
    });
  }
};

// Obtener ranking de un jugador en un grupo específico
exports.getPlayerRankingInGroup = async (req, res) => {
  try {
    const { groupId, playerId } = req.params;

    const whereConditions = {
      ranking_group_id: groupId,
      is_visible: true
    };

    // Buscar por ID de usuario o por nombre externo
    if (playerId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      whereConditions.player_id = playerId;
    } else {
      whereConditions.external_player_name = playerId;
      whereConditions.is_external = true;
    }

    const ranking = await Ranking.findOne({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'player',
          attributes: ['id', 'username', 'email', 'profile_data'],
          required: false
        },
        {
          model: RankingGroup,
          as: 'rankingGroup',
          attributes: ['id', 'name', 'ranking_type', 'start_date', 'end_date']
        }
      ]
    });

    if (!ranking) {
      return res.status(404).json({ 
        message: 'No se encontró ranking para este jugador en el grupo especificado' 
      });
    }

    // Preparar información del jugador
    const playerInfo = ranking.player ? {
      id: ranking.player.id,
      username: ranking.player.username,
      email: ranking.player.email,
      profile: ranking.player.profile_data
    } : {
      name: ranking.external_player_name,
      email: ranking.external_player_email,
      isExternal: true
    };

    res.json({
      success: true,
      player: playerInfo,
      group: {
        id: ranking.rankingGroup.id,
        name: ranking.rankingGroup.name,
        type: ranking.rankingGroup.ranking_type
      },
      ranking: {
        position: ranking.position,
        points: ranking.points,
        handsPlayed: ranking.hands_played,
        tournamentsPlayed: ranking.tournaments_played,
        totalRake: ranking.total_rake,
        wins: ranking.wins,
        losses: ranking.losses,
        winRate: ranking.win_rate,
        history: ranking.history
      }
    });
  } catch (error) {
    console.error('Error al obtener ranking del jugador:', error);
    res.status(500).json({ 
      message: 'Error al obtener ranking del jugador',
      error: error.message 
    });
  }
};

// === FUNCIONES DE ADMINISTRADOR ===

// Obtener todos los rankings de un grupo (incluye ocultos)
exports.getAllRankingsInGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { 
      includeHidden = true,
      page = 1,
      limit = 50
    } = req.query;

    const offset = (page - 1) * limit;
    const whereConditions = {
      ranking_group_id: groupId
    };

    if (!includeHidden) {
      whereConditions.is_visible = true;
    }

    // Verificar que el grupo existe
    const group = await RankingGroup.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ 
        message: 'Grupo de ranking no encontrado' 
      });
    }

    const { count, rows: rankings } = await Ranking.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'player',
          attributes: ['id', 'username', 'email', 'profile_data'],
          required: false
        },
        {
          model: User,
          as: 'updatedBy',
          attributes: ['username'],
          required: false
        },
        {
          model: RankingGroup,
          as: 'rankingGroup',
          attributes: ['id', 'name', 'ranking_type']
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

    // Agregar información de display
    rankings.forEach((ranking, index) => {
      ranking.dataValues.position = offset + index + 1;
      ranking.dataValues.displayName = ranking.player 
        ? ranking.player.username 
        : ranking.external_player_name;
      ranking.dataValues.displayEmail = ranking.player 
        ? ranking.player.email 
        : ranking.external_player_email;
    });

    res.json({
      success: true,
      group: {
        id: group.id,
        name: group.name,
        type: group.ranking_type
      },
      rankings,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalRecords: count
    });
  } catch (error) {
    console.error('Error al obtener todos los rankings del grupo:', error);
    res.status(500).json({ 
      message: 'Error al obtener rankings',
      error: error.message 
    });
  }
};

// Crear o actualizar ranking en un grupo
exports.updateRankingInGroup = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { groupId, playerId } = req.params;
    const { 
      points,
      handsPlayed,
      tournamentsPlayed,
      totalRake,
      wins,
      losses,
      isVisible = true,
      externalPlayerName,
      externalPlayerEmail
    } = req.body;

    // Verificar que el grupo existe
    const group = await RankingGroup.findByPk(groupId, { transaction: t });
    if (!group) {
      return res.status(404).json({ 
        message: 'Grupo de ranking no encontrado' 
      });
    }

    let player = null;
    let isExternal = false;
    let whereClause = {};

    // Determinar si es un jugador registrado o externo
    if (playerId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      player = await User.findByPk(playerId);
      if (player) {
        whereClause = {
          player_id: playerId,
          ranking_group_id: groupId
        };
      } else {
        isExternal = true;
      }
    } else {
      isExternal = true;
    }

    if (isExternal) {
      whereClause = {
        external_player_name: externalPlayerName || playerId,
        is_external: true,
        ranking_group_id: groupId
      };
    }

    // Buscar o crear ranking
    const [ranking, created] = await Ranking.findOrCreate({
      where: whereClause,
      defaults: {
        ranking_group_id: groupId,
        player_id: player ? player.id : null,
        is_external: isExternal,
        external_player_name: isExternal ? (externalPlayerName || playerId) : null,
        external_player_email: isExternal ? externalPlayerEmail : null,
        last_updated_by: req.user.id
      },
      transaction: t
    });

    // Actualizar valores según el tipo de ranking del grupo
    switch (group.ranking_type) {
      case 'points':
        if (points !== undefined) ranking.points = points;
        break;
      case 'hands_played':
        if (handsPlayed !== undefined) ranking.hands_played = handsPlayed;
        break;
      case 'tournaments':
        if (tournamentsPlayed !== undefined) ranking.tournaments_played = tournamentsPlayed;
        break;
      case 'rake':
        if (totalRake !== undefined) ranking.total_rake = totalRake;
        break;
    }

    // Campos comunes que siempre se pueden actualizar
    if (wins !== undefined) {
      ranking.wins = wins;
      ranking.games_played = ranking.wins + ranking.losses;
    }
    if (losses !== undefined) {
      ranking.losses = losses;
      ranking.games_played = ranking.wins + ranking.losses;
    }
    if (isVisible !== undefined) ranking.is_visible = isVisible;

    ranking.last_updated_by = req.user.id;
    await ranking.save({ transaction: t });

    await t.commit();

    // Actualizar posiciones
    await Ranking.updatePositions(groupId);

    res.json({
      success: true,
      message: created ? 'Ranking creado exitosamente' : 'Ranking actualizado exitosamente',
      ranking
    });
  } catch (error) {
    await t.rollback();
    console.error('Error al actualizar ranking:', error);
    res.status(500).json({ 
      message: 'Error al actualizar ranking',
      error: error.message 
    });
  }
};

// Importar rankings desde Excel a un grupo
exports.importToGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ 
        message: 'Archivo Excel requerido' 
      });
    }

    // Verificar que el grupo existe
    const group = await RankingGroup.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ 
        message: 'Grupo de ranking no encontrado' 
      });
    }

    // Parsear archivo Excel
    const data = await excelService.parseRankingFile(req.file.path);
    
    // Agregar nombre del archivo a cada fila
    data.forEach(row => {
      row._filename = req.file.originalname;
    });

    // Validar datos antes de procesar
    const validationErrors = excelService.validateRankingData(data);
    if (validationErrors.length > 0) {
      await fs.unlink(req.file.path);
      return res.status(400).json({
        message: 'Errores de validación en el archivo',
        errors: validationErrors
      });
    }

    // Procesar datos en el grupo específico
    const results = await Ranking.createOrUpdateFromExcel(data, req.user.id, groupId);

    // Eliminar archivo temporal
    await fs.unlink(req.file.path);

    res.json({
      success: true,
      message: 'Rankings importados exitosamente al grupo',
      group: {
        id: group.id,
        name: group.name,
        type: group.ranking_type
      },
      summary: {
        created: results.created,
        updated: results.updated,
        errors: results.errors.length,
        total: data.length
      },
      errors: results.errors
    });
  } catch (error) {
    // Intentar eliminar archivo si existe
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (err) {
        console.error('Error al eliminar archivo temporal:', err);
      }
    }

    console.error('Error al importar rankings:', error);
    res.status(500).json({ 
      message: 'Error al importar rankings',
      error: error.message 
    });
  }
};

// Cambiar visibilidad de rankings
exports.toggleVisibility = async (req, res) => {
  try {
    const { rankingId } = req.params;
    const { isVisible } = req.body;

    const ranking = await Ranking.findByPk(rankingId);
    
    if (!ranking) {
      return res.status(404).json({ 
        message: 'Ranking no encontrado' 
      });
    }

    ranking.is_visible = isVisible;
    ranking.last_updated_by = req.user.id;
    await ranking.save();

    res.json({
      success: true,
      message: `Ranking ${isVisible ? 'mostrado' : 'ocultado'} exitosamente`,
      ranking
    });
  } catch (error) {
    console.error('Error al cambiar visibilidad:', error);
    res.status(500).json({ 
      message: 'Error al cambiar visibilidad',
      error: error.message 
    });
  }
};

// Eliminar ranking
exports.deleteRanking = async (req, res) => {
  try {
    const { rankingId } = req.params;

    const ranking = await Ranking.findByPk(rankingId, {
      include: [
        {
          model: RankingGroup,
          as: 'rankingGroup'
        }
      ]
    });
    
    if (!ranking) {
      return res.status(404).json({ 
        message: 'Ranking no encontrado' 
      });
    }

    const groupId = ranking.ranking_group_id;

    // Soft delete
    await ranking.destroy();

    // Recalcular posiciones en el grupo
    await Ranking.updatePositions(groupId);

    res.json({
      success: true,
      message: 'Ranking eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar ranking:', error);
    res.status(500).json({ 
      message: 'Error al eliminar ranking',
      error: error.message 
    });
  }
};

// Recalcular posiciones de un grupo
exports.recalculateGroupPositions = async (req, res) => {
  try {
    const { groupId } = req.params;

    // Verificar que el grupo existe
    const group = await RankingGroup.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ 
        message: 'Grupo de ranking no encontrado' 
      });
    }

    const totalUpdated = await Ranking.updatePositions(groupId);

    res.json({
      success: true,
      message: 'Posiciones recalculadas exitosamente',
      totalUpdated,
      group: {
        id: group.id,
        name: group.name,
        type: group.ranking_type
      }
    });
  } catch (error) {
    console.error('Error al recalcular posiciones:', error);
    res.status(500).json({ 
      message: 'Error al recalcular posiciones',
      error: error.message 
    });
  }
};

// Obtener estadísticas de un grupo
exports.getGroupStats = async (req, res) => {
  try {
    const { groupId } = req.params;
    
    // Verificar que el grupo existe
    const group = await RankingGroup.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ 
        message: 'Grupo de ranking no encontrado' 
      });
    }

    // Total de jugadores
    const totalPlayers = await Ranking.count({
      where: { ranking_group_id: groupId }
    });

    // Jugadores externos vs registrados
    const playerDistribution = await Ranking.findAll({
      where: { ranking_group_id: groupId },
      attributes: [
        'is_external',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['is_external']
    });

    // Promedios según el tipo de ranking
    const fieldMap = {
      'points': 'points',
      'hands_played': 'hands_played',
      'tournaments': 'tournaments_played',
      'rake': 'total_rake'
    };

    const primaryField = fieldMap[group.ranking_type];
    const averages = await Ranking.findOne({
      where: { 
        ranking_group_id: groupId,
        is_visible: true 
      },
      attributes: [
        [sequelize.fn('AVG', sequelize.col(primaryField)), 'avgValue'],
        [sequelize.fn('AVG', sequelize.col('wins')), 'avgWins'],
        [sequelize.fn('AVG', sequelize.col('losses')), 'avgLosses'],
        [sequelize.fn('AVG', sequelize.col('win_rate')), 'avgWinRate']
      ]
    });

    // Top 10 jugadores
    const topPlayers = await Ranking.findAll({
      where: { 
        ranking_group_id: groupId,
        is_visible: true 
      },
      include: [{
        model: User,
        as: 'player',
        attributes: ['username', 'profile_data'],
        required: false
      }],
      order: [[primaryField, 'DESC']],
      limit: 10
    });

    // Agregar nombres de display a top players
    topPlayers.forEach(ranking => {
      ranking.dataValues.displayName = ranking.player 
        ? ranking.player.username 
        : ranking.external_player_name;
    });

    // Últimas actualizaciones
    const recentUpdates = await Ranking.findAll({
      where: { ranking_group_id: groupId },
      include: [
        {
          model: User,
          as: 'player',
          attributes: ['username'],
          required: false
        },
        {
          model: User,
          as: 'updatedBy',
          attributes: ['username']
        }
      ],
      order: [['updated_at', 'DESC']],
      limit: 10
    });

    res.json({
      success: true,
      group: {
        id: group.id,
        name: group.name,
        type: group.ranking_type,
        startDate: group.start_date,
        endDate: group.end_date,
        isActive: new Date() >= group.start_date && new Date() <= group.end_date
      },
      stats: {
        totalPlayers,
        playerDistribution: {
          registered: playerDistribution.find(p => !p.is_external)?.dataValues.count || 0,
          external: playerDistribution.find(p => p.is_external)?.dataValues.count || 0
        },
        averages: {
          primaryField: group.ranking_type,
          avgValue: parseFloat(averages?.dataValues.avgValue) || 0,
          avgWins: parseFloat(averages?.dataValues.avgWins) || 0,
          avgLosses: parseFloat(averages?.dataValues.avgLosses) || 0,
          avgWinRate: parseFloat(averages?.dataValues.avgWinRate) || 0
        },
        topPlayers,
        recentUpdates
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas del grupo:', error);
    res.status(500).json({ 
      message: 'Error al obtener estadísticas',
      error: error.message 
    });
  }
};
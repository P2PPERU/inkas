const { Ranking, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../models').sequelize;
const excelService = require('../services/excel.service');
const fs = require('fs').promises;
const path = require('path');

// Obtener rankings públicos
exports.getRankings = async (req, res) => {
  try {
    const { 
      type = 'points', 
      season, 
      period = 'all_time',
      page = 1, 
      limit = 50 
    } = req.query;

    const validTypes = ['points', 'hands_played', 'tournaments', 'rake'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        message: 'Tipo de ranking inválido' 
      });
    }

    const offset = (page - 1) * limit;

    const whereConditions = {
      ranking_type: type,
      is_visible: true,
      ranking_period: period
    };

    if (season) {
      whereConditions.season = season;
    } else {
      // Por defecto, temporada actual
      const now = new Date();
      whereConditions.season = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    // Determinar campo de ordenamiento
    let orderField = 'points';
    switch (type) {
      case 'hands_played':
        orderField = 'hands_played';
        break;
      case 'tournaments':
        orderField = 'tournaments_played';
        break;
      case 'rake':
        orderField = 'total_rake';
        break;
    }

    const { count, rows: rankings } = await Ranking.findAndCountAll({
      where: whereConditions,
      include: [{
        model: User,
        as: 'player',
        attributes: ['id', 'username', 'profile_data', 'balance'],
        required: false // CAMBIO: No requerir usuario
      }],
      order: [[orderField, 'DESC']],
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
      type,
      season: whereConditions.season,
      period,
      rankings,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalPlayers: count
    });
  } catch (error) {
    console.error('Error al obtener rankings:', error);
    res.status(500).json({ 
      message: 'Error al obtener rankings',
      error: error.message 
    });
  }
};

// Obtener ranking de un jugador específico
exports.getPlayerRanking = async (req, res) => {
  try {
    const { playerId } = req.params;
    const { type = 'all' } = req.query;

    const whereConditions = {
      is_visible: true
    };

    // Buscar por ID de usuario o por nombre externo
    if (playerId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      // Es un UUID - buscar por player_id
      whereConditions.player_id = playerId;
    } else {
      // Es un nombre - buscar por external_player_name
      whereConditions.external_player_name = playerId;
      whereConditions.is_external = true;
    }

    if (type !== 'all') {
      whereConditions.ranking_type = type;
    }

    const rankings = await Ranking.findAll({
      where: whereConditions,
      include: [{
        model: User,
        as: 'player',
        attributes: ['id', 'username', 'profile_data'],
        required: false
      }],
      order: [['season', 'DESC'], ['ranking_type', 'ASC']]
    });

    if (rankings.length === 0) {
      return res.status(404).json({ 
        message: 'No se encontraron rankings para este jugador' 
      });
    }

    // Preparar información del jugador
    const playerInfo = rankings[0].player ? {
      id: rankings[0].player.id,
      username: rankings[0].player.username,
      profile: rankings[0].player.profile_data
    } : {
      name: rankings[0].external_player_name,
      email: rankings[0].external_player_email,
      isExternal: true
    };

    res.json({
      success: true,
      player: playerInfo,
      rankings: rankings.map(r => ({
        type: r.ranking_type,
        season: r.season,
        period: r.ranking_period,
        position: r.position,
        points: r.points,
        handsPlayed: r.hands_played,
        tournamentsPlayed: r.tournaments_played,
        totalRake: r.total_rake,
        winRate: r.win_rate,
        history: r.history
      }))
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

// Obtener todos los rankings (incluye ocultos)
exports.getAllRankings = async (req, res) => {
  try {
    const { 
      type = 'points',
      season,
      period = 'all_time',
      includeHidden = true,
      page = 1,
      limit = 50
    } = req.query;

    const offset = (page - 1) * limit;
    const whereConditions = {
      ranking_type: type,
      ranking_period: period
    };

    if (!includeHidden) {
      whereConditions.is_visible = true;
    }

    if (season) {
      whereConditions.season = season;
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
        }
      ],
      order: [['points', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    // Agregar información de display
    rankings.forEach(ranking => {
      ranking.dataValues.displayName = ranking.player 
        ? ranking.player.username 
        : ranking.external_player_name;
      ranking.dataValues.displayEmail = ranking.player 
        ? ranking.player.email 
        : ranking.external_player_email;
    });

    res.json({
      success: true,
      rankings,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalRecords: count
    });
  } catch (error) {
    console.error('Error al obtener todos los rankings:', error);
    res.status(500).json({ 
      message: 'Error al obtener rankings',
      error: error.message 
    });
  }
};

// Crear o actualizar ranking manual
exports.updateRanking = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { playerId } = req.params;
    const { 
      type = 'points',
      points,
      handsPlayed,
      tournamentsPlayed,
      totalRake,
      wins,
      losses,
      season,
      period = 'all_time',
      isVisible = true,
      // Nuevos campos para jugadores externos
      externalPlayerName,
      externalPlayerEmail
    } = req.body;

    let player = null;
    let isExternal = false;
    let whereClause = {};

    // Determinar si es un jugador registrado o externo
    if (playerId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      // Es un UUID - buscar usuario
      player = await User.findByPk(playerId);
      if (player) {
        whereClause = {
          player_id: playerId,
          ranking_type: type,
          season: season || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
          ranking_period: period
        };
      } else {
        // UUID no válido, crear como externo
        isExternal = true;
      }
    } else {
      // No es UUID, crear como jugador externo
      isExternal = true;
    }

    if (isExternal) {
      whereClause = {
        external_player_name: externalPlayerName || playerId,
        is_external: true,
        ranking_type: type,
        season: season || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        ranking_period: period
      };
    }

    // Buscar o crear ranking
    const [ranking, created] = await Ranking.findOrCreate({
      where: whereClause,
      defaults: {
        player_id: player ? player.id : null,
        is_external: isExternal,
        external_player_name: isExternal ? (externalPlayerName || playerId) : null,
        external_player_email: isExternal ? externalPlayerEmail : null,
        last_updated_by: req.user.id
      },
      transaction: t
    });

    // Actualizar valores
    if (points !== undefined) ranking.points = points;
    if (handsPlayed !== undefined) ranking.hands_played = handsPlayed;
    if (tournamentsPlayed !== undefined) ranking.tournaments_played = tournamentsPlayed;
    if (totalRake !== undefined) ranking.total_rake = totalRake;
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
    await Ranking.updatePositions(type, ranking.season, period);

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

// Importar rankings desde Excel
exports.importFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        message: 'Archivo Excel requerido' 
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

    // Procesar datos
    const results = await Ranking.createOrUpdateFromExcel(data, req.user.id);

    // Eliminar archivo temporal
    await fs.unlink(req.file.path);

    res.json({
      success: true,
      message: 'Rankings importados exitosamente',
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

    const ranking = await Ranking.findByPk(rankingId);
    
    if (!ranking) {
      return res.status(404).json({ 
        message: 'Ranking no encontrado' 
      });
    }

    // Soft delete
    await ranking.destroy();

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

// Obtener estadísticas de rankings
exports.getRankingStats = async (req, res) => {
  try {
    const { season } = req.query;
    
    const whereConditions = {};
    if (season) {
      whereConditions.season = season;
    }

    // Total de jugadores por tipo de ranking
    const playersByType = await Ranking.findAll({
      where: whereConditions,
      attributes: [
        'ranking_type',
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', 
          sequelize.literal(`COALESCE(player_id::text, external_player_name)`)
        )), 'players']
      ],
      group: ['ranking_type']
    });

    // Jugadores externos vs registrados
    const playerDistribution = await Ranking.findAll({
      where: whereConditions,
      attributes: [
        'is_external',
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', 
          sequelize.literal(`COALESCE(player_id::text, external_player_name)`)
        )), 'count']
      ],
      group: ['is_external']
    });

    // Promedios por tipo
    const averagesByType = await Ranking.findAll({
      where: { ...whereConditions, is_visible: true },
      attributes: [
        'ranking_type',
        [sequelize.fn('AVG', sequelize.col('points')), 'avgPoints'],
        [sequelize.fn('AVG', sequelize.col('hands_played')), 'avgHands'],
        [sequelize.fn('AVG', sequelize.col('tournaments_played')), 'avgTournaments'],
        [sequelize.fn('AVG', sequelize.col('total_rake')), 'avgRake']
      ],
      group: ['ranking_type']
    });

    // Top 10 jugadores globales
    const topPlayers = await Ranking.findAll({
      where: { 
        ...whereConditions, 
        ranking_type: 'points',
        is_visible: true 
      },
      include: [{
        model: User,
        as: 'player',
        attributes: ['username', 'profile_data'],
        required: false
      }],
      order: [['points', 'DESC']],
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
      where: whereConditions,
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
      limit: 20
    });

    res.json({
      success: true,
      stats: {
        playersByType: playersByType.map(p => ({
          type: p.ranking_type,
          players: parseInt(p.dataValues.players)
        })),
        playerDistribution: {
          registered: playerDistribution.find(p => !p.is_external)?.dataValues.count || 0,
          external: playerDistribution.find(p => p.is_external)?.dataValues.count || 0
        },
        averages: averagesByType.map(a => ({
          type: a.ranking_type,
          avgPoints: parseFloat(a.dataValues.avgPoints) || 0,
          avgHands: parseFloat(a.dataValues.avgHands) || 0,
          avgTournaments: parseFloat(a.dataValues.avgTournaments) || 0,
          avgRake: parseFloat(a.dataValues.avgRake) || 0
        })),
        topPlayers,
        recentUpdates
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

// Recalcular todas las posiciones
exports.recalculatePositions = async (req, res) => {
  try {
    const { type = 'all', season, period = 'all_time' } = req.body;

    const types = type === 'all' 
      ? ['points', 'hands_played', 'tournaments', 'rake'] 
      : [type];

    let totalUpdated = 0;

    for (const rankingType of types) {
      const updated = await Ranking.updatePositions(rankingType, season, period);
      totalUpdated += updated;
    }

    res.json({
      success: true,
      message: 'Posiciones recalculadas exitosamente',
      totalUpdated
    });
  } catch (error) {
    console.error('Error al recalcular posiciones:', error);
    res.status(500).json({ 
      message: 'Error al recalcular posiciones',
      error: error.message 
    });
  }
};

// Descargar plantilla de Excel
exports.downloadTemplate = async (req, res) => {
  try {
    const templatePath = path.join(__dirname, '../../templates/ranking_template.xlsx');
    
    // Verificar si existe la plantilla
    try {
      await fs.access(templatePath);
    } catch (error) {
      // Si no existe, crear una plantilla básica
      const template = await excelService.createRankingTemplate();
      await fs.writeFile(templatePath, template);
    }

    res.download(templatePath, 'plantilla_rankings.xlsx');
  } catch (error) {
    console.error('Error al descargar plantilla:', error);
    res.status(500).json({ 
      message: 'Error al descargar plantilla',
      error: error.message 
    });
  }
};

// Buscar jugadores por nombre (útil para autocompletado)
exports.searchPlayers = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({ 
        message: 'La búsqueda debe tener al menos 2 caracteres' 
      });
    }

    // Buscar en usuarios registrados
    const users = await User.findAll({
      where: {
        [Op.or]: [
          { username: { [Op.iLike]: `%${query}%` } },
          { email: { [Op.iLike]: `%${query}%` } }
        ]
      },
      attributes: ['id', 'username', 'email'],
      limit: 10
    });

    // Buscar en jugadores externos
    const externalPlayers = await Ranking.findAll({
      where: {
        is_external: true,
        external_player_name: { [Op.iLike]: `%${query}%` }
      },
      attributes: [
        [sequelize.fn('DISTINCT', sequelize.col('external_player_name')), 'name'],
        'external_player_email'
      ],
      limit: 10
    });

    res.json({
      success: true,
      results: {
        registered: users,
        external: externalPlayers
      }
    });
  } catch (error) {
    console.error('Error al buscar jugadores:', error);
    res.status(500).json({ 
      message: 'Error al buscar jugadores',
      error: error.message 
    });
  }
};
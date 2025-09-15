// src/routes/ranking.routes.js - Versión actualizada con soporte legacy
const express = require('express');
const router = express.Router();
const rankingController = require('../controllers/ranking.controller');
const rankingGroupController = require('../controllers/rankingGroup.controller');
const { protect } = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/roleCheck');
const { uploadExcel } = require('../config/multer');

// === RUTAS DE COMPATIBILIDAD (Legacy) ===
// Estas rutas mantienen la compatibilidad con el sistema anterior

router.get('/', async (req, res) => {
  try {
    // Redirigir a la nueva estructura manteniendo compatibilidad
    const result = await rankingGroupController.getRankingGroups(req, res);
  } catch (error) {
    console.error('Error en compatibilidad legacy:', error);
    res.status(500).json({ 
      message: 'Error al obtener rankings',
      error: error.message 
    });
  }
});

router.get('/player/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { type = 'all' } = req.query;

    // Buscar en todos los grupos activos
    const whereConditions = {
      is_visible: true
    };

    // Buscar por ID de usuario o por nombre externo
    if (playerId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      whereConditions.player_id = playerId;
    } else {
      whereConditions.external_player_name = playerId;
      whereConditions.is_external = true;
    }

    const { Ranking, RankingGroup, User } = require('../models');

    const rankings = await Ranking.findAll({
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
          attributes: ['id', 'name', 'ranking_type', 'start_date', 'end_date'],
          where: { is_visible: true }
        }
      ],
      order: [['updated_at', 'DESC']]
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
      email: rankings[0].player.email,
      profile: rankings[0].player.profile_data
    } : {
      name: rankings[0].external_player_name,
      email: rankings[0].external_player_email,
      isExternal: true
    };

    // Filtrar por tipo si se especifica
    const filteredRankings = type === 'all' ? rankings : 
      rankings.filter(r => r.rankingGroup.ranking_type === type);

    res.json({
      success: true,
      player: playerInfo,
      rankings: filteredRankings.map(r => ({
        groupId: r.rankingGroup.id,
        groupName: r.rankingGroup.name,
        type: r.rankingGroup.ranking_type,
        startDate: r.rankingGroup.start_date,
        endDate: r.rankingGroup.end_date,
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
});

// === RUTAS ADMINISTRATIVAS HEREDADAS ===
router.use(protect, isAdmin);

router.get('/groups', rankingGroupController.getAllRankingGroups);

router.post('/groups', rankingGroupController.createRankingGroup);

router.get('/groups/:groupId', rankingController.getAllRankingsInGroup);

router.put('/groups/:groupId', rankingGroupController.updateRankingGroup);

router.delete('/groups/:groupId', rankingGroupController.deleteRankingGroup);

router.put('/groups/:groupId/players/:playerId', rankingController.updateRankingInGroup);

router.post('/groups/:groupId/import', uploadExcel.single('file'), rankingController.importToGroup);

router.put('/:rankingId/visibility', rankingController.toggleVisibility);

router.delete('/:rankingId', rankingController.deleteRanking);

router.post('/groups/:groupId/recalculate', rankingController.recalculateGroupPositions);

router.get('/groups/:groupId/stats', rankingController.getGroupStats);

router.get('/template', async (req, res) => {
  try {
    const excelService = require('../services/excel.service');
    const path = require('path');
    
    const templatePath = path.join(__dirname, '../../templates/ranking_template.xlsx');
    
    // Verificar si existe la plantilla
    try {
      await require('fs').promises.access(templatePath);
    } catch (error) {
      // Si no existe, crear una plantilla básica
      const template = await excelService.createRankingTemplate();
      await require('fs').promises.writeFile(templatePath, template);
    }

    res.download(templatePath, 'plantilla_rankings.xlsx');
  } catch (error) {
    console.error('Error al descargar plantilla:', error);
    res.status(500).json({ 
      message: 'Error al descargar plantilla',
      error: error.message 
    });
  }
});

router.get('/search/players', async (req, res) => {
  try {
    const { query } = req.query;
    const { Op } = require('sequelize');
    const { User, Ranking } = require('../models');

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
    const sequelize = require('../models').sequelize;
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
});

module.exports = router;
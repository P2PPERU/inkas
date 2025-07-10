const Ranking = require('../models/Ranking.model');
const User = require('../models/User.model');
const excelService = require('../services/excel.service');

// Obtener rankings
exports.getRankings = async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = 'points' } = req.query;

    const rankings = await Ranking.find()
      .populate('player', 'username profile.firstName profile.lastName')
      .sort({ [sortBy]: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Ranking.countDocuments();

    res.json({
      success: true,
      rankings,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al obtener rankings',
      error: error.message 
    });
  }
};

// Actualizar ranking manual
exports.updateRanking = async (req, res) => {
  try {
    const { playerId } = req.params;
    const { points, wins, losses } = req.body;

    let ranking = await Ranking.findOne({ player: playerId });

    if (!ranking) {
      ranking = new Ranking({ player: playerId });
    }

    if (points !== undefined) ranking.points = points;
    if (wins !== undefined) {
      ranking.wins = wins;
      ranking.gamesPlayed = ranking.wins + ranking.losses;
    }
    if (losses !== undefined) {
      ranking.losses = losses;
      ranking.gamesPlayed = ranking.wins + ranking.losses;
    }

    await ranking.save();

    res.json({
      success: true,
      ranking
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al actualizar ranking',
      error: error.message 
    });
  }
};

// Importar desde Excel
exports.importFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        message: 'Archivo Excel requerido' 
      });
    }

    const data = await excelService.parseRankingFile(req.file.path);
    const results = await excelService.updateRankingsFromData(data);

    res.json({
      success: true,
      message: 'Rankings importados exitosamente',
      processed: results.length,
      results
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al importar rankings',
      error: error.message 
    });
  }
};
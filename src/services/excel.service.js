const XLSX = require('xlsx');
const fs = require('fs').promises;
const User = require('../models/User.model');
const Ranking = require('../models/Ranking.model');

exports.parseRankingFile = async (filePath) => {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    // Limpiar archivo temporal
    await fs.unlink(filePath);

    return data;
  } catch (error) {
    throw new Error(`Error al parsear archivo Excel: ${error.message}`);
  }
};

exports.updateRankingsFromData = async (data) => {
  const results = [];

  for (const row of data) {
    try {
      // Buscar usuario por username o email
      const user = await User.findOne({
        $or: [
          { username: row.username },
          { email: row.email }
        ]
      });

      if (!user) {
        results.push({
          row,
          status: 'error',
          message: 'Usuario no encontrado'
        });
        continue;
      }

      // Actualizar o crear ranking
      let ranking = await Ranking.findOne({ player: user._id });
      
      if (!ranking) {
        ranking = new Ranking({ player: user._id });
      }

      // Actualizar datos
      if (row.points !== undefined) ranking.points = parseInt(row.points);
      if (row.wins !== undefined) ranking.wins = parseInt(row.wins);
      if (row.losses !== undefined) ranking.losses = parseInt(row.losses);
      
      ranking.gamesPlayed = ranking.wins + ranking.losses;
      
      await ranking.save();

      results.push({
        username: user.username,
        status: 'success',
        message: 'Ranking actualizado'
      });
    } catch (error) {
      results.push({
        row,
        status: 'error',
        message: error.message
      });
    }
  }

  return results;
};
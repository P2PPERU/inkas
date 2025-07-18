const XLSX = require('xlsx');
const fs = require('fs').promises;

class ExcelService {
  // Parsear archivo de rankings
  async parseRankingFile(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convertir a JSON con opciones específicas
      const data = XLSX.utils.sheet_to_json(worksheet, {
        header: 1, // Usar array en lugar de objeto
        defval: '', // Valor por defecto para celdas vacías
        blankrows: false // No incluir filas vacías
      });

      if (data.length < 2) {
        throw new Error('El archivo Excel está vacío o no tiene el formato correcto');
      }

      // La primera fila contiene los headers
      const headers = data[0].map(h => this.normalizeHeader(h));
      
      // Convertir las demás filas a objetos
      const rows = [];
      for (let i = 1; i < data.length; i++) {
        const row = {};
        let hasData = false;
        
        for (let j = 0; j < headers.length; j++) {
          const value = data[i][j];
          if (value !== '' && value !== null && value !== undefined) {
            hasData = true;
            row[headers[j]] = value;
          }
        }
        
        // Solo agregar filas que tengan al menos un dato
        if (hasData) {
          rows.push(row);
        }
      }

      return rows;
    } catch (error) {
      throw new Error(`Error al parsear archivo Excel: ${error.message}`);
    }
  }

  // Normalizar headers (quitar espacios, convertir a minúsculas, etc.)
  normalizeHeader(header) {
    if (!header) return '';
    
    const mappings = {
      'usuario': 'username',
      'jugador': 'username',
      'player': 'username',
      'nombre': 'username',
      'email': 'email',
      'correo': 'email',
      'puntos': 'points',
      'points': 'points',
      'manos': 'hands_played',
      'hands': 'hands_played',
      'manos jugadas': 'hands_played',
      'hands played': 'hands_played',
      'torneos': 'tournaments',
      'tournaments': 'tournaments',
      'torneos jugados': 'tournaments',
      'tournaments played': 'tournaments',
      'rake': 'rake',
      'total rake': 'rake',
      'ganadas': 'wins',
      'wins': 'wins',
      'perdidas': 'losses',
      'losses': 'losses',
      'temporada': 'season',
      'season': 'season',
      'periodo': 'period',
      'period': 'period'
    };

    const normalized = header.toString().toLowerCase().trim();
    return mappings[normalized] || normalized.replace(/\s+/g, '_');
  }

  // Crear plantilla de Excel para rankings
  async createRankingTemplate() {
    const wb = XLSX.utils.book_new();
    
    // Datos de ejemplo - ahora con jugadores externos
    const data = [
      {
        'Usuario': 'cliente1',
        'Email': 'cliente1@poker.com',
        'Puntos': 1000,
        'Manos Jugadas': 500,
        'Torneos': 10,
        'Rake': 250.50,
        'Ganadas': 300,
        'Perdidas': 200,
        'Temporada': '2025-01',
        'Periodo': 'monthly'
      },
      {
        'Usuario': 'jugador_externo_1',
        'Email': '',
        'Puntos': 850,
        'Manos Jugadas': 400,
        'Torneos': 8,
        'Rake': 200.00,
        'Ganadas': 250,
        'Perdidas': 150,
        'Temporada': '2025-01',
        'Periodo': 'monthly'
      },
      {
        'Usuario': 'ProPoker2025',
        'Email': 'pro@external.com',
        'Puntos': 1200,
        'Manos Jugadas': 600,
        'Torneos': 15,
        'Rake': 300.00,
        'Ganadas': 400,
        'Perdidas': 200,
        'Temporada': '2025-01',
        'Periodo': 'monthly'
      }
    ];

    // Crear hoja con datos de ejemplo
    const ws = XLSX.utils.json_to_sheet(data);

    // Ajustar ancho de columnas
    const colWidths = [
      { wch: 20 }, // Usuario
      { wch: 25 }, // Email
      { wch: 10 }, // Puntos
      { wch: 15 }, // Manos Jugadas
      { wch: 10 }, // Torneos
      { wch: 10 }, // Rake
      { wch: 10 }, // Ganadas
      { wch: 10 }, // Perdidas
      { wch: 12 }, // Temporada
      { wch: 10 }  // Periodo
    ];
    ws['!cols'] = colWidths;

    // Crear hoja de instrucciones
    const instructions = [
      ['INSTRUCCIONES PARA IMPORTAR RANKINGS'],
      [''],
      ['1. Complete los datos en la hoja "Datos"'],
      ['2. Puede incluir jugadores registrados o externos:'],
      ['   - Para jugadores registrados: use su username o email exacto'],
      ['   - Para jugadores externos: puede usar cualquier nombre'],
      [''],
      ['3. Columnas disponibles:'],
      ['   - Usuario/Jugador/Player/Nombre: Identificador del jugador'],
      ['   - Email/Correo: Email del jugador (opcional para externos)'],
      ['   - Puntos/Points: Puntos totales'],
      ['   - Manos/Manos Jugadas/Hands Played: Total de manos jugadas'],
      ['   - Torneos/Tournaments: Torneos jugados'],
      ['   - Rake/Total Rake: Rake generado'],
      ['   - Ganadas/Wins: Partidas ganadas'],
      ['   - Perdidas/Losses: Partidas perdidas'],
      ['   - Temporada/Season: Formato YYYY-MM (ej: 2025-01)'],
      ['   - Periodo/Period: all_time, monthly, weekly, daily'],
      [''],
      ['4. Notas importantes:'],
      ['   - No es necesario que los jugadores estén registrados en el sistema'],
      ['   - Si el usuario existe en el sistema, se vinculará automáticamente'],
      ['   - Si no existe, se creará como jugador externo'],
      ['   - Puede actualizar solo los campos que necesite'],
      ['   - Las posiciones se calculan automáticamente'],
      [''],
      ['5. Ejemplos válidos:'],
      ['   - Solo nombres y manos jugadas'],
      ['   - Solo emails y puntos'],
      ['   - Mezcla de jugadores registrados y externos']
    ];

    const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
    wsInstructions['!cols'] = [{ wch: 80 }];

    // Agregar hojas al libro
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instrucciones');
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');

    // Escribir a buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  }

  // Validar datos antes de importar
  validateRankingData(data) {
    const errors = [];
    const validPeriods = ['all_time', 'monthly', 'weekly', 'daily'];

    data.forEach((row, index) => {
      // Validar que tenga algún identificador
      if (!row.username && !row.email) {
        errors.push(`Fila ${index + 2}: Debe tener Usuario o Email`);
      }

      // Validar que tenga al menos un dato de ranking
      const hasRankingData = row.points || row.hands_played || 
                           row.tournaments || row.rake;
      if (!hasRankingData) {
        errors.push(`Fila ${index + 2}: Debe tener al menos un valor de ranking (puntos, manos, torneos o rake)`);
      }

      // Validar periodo si existe
      if (row.period && !validPeriods.includes(row.period)) {
        errors.push(`Fila ${index + 2}: Periodo inválido. Valores válidos: ${validPeriods.join(', ')}`);
      }

      // Validar que los números sean válidos
      const numericFields = ['points', 'hands_played', 'tournaments', 'rake', 'wins', 'losses'];
      numericFields.forEach(field => {
        if (row[field] !== undefined && row[field] !== '') {
          const value = parseFloat(row[field]);
          if (isNaN(value) || value < 0) {
            errors.push(`Fila ${index + 2}: ${field} debe ser un número positivo`);
          }
        }
      });

      // Validar formato de temporada si existe
      if (row.season && !/^\d{4}-\d{2}$/.test(row.season)) {
        errors.push(`Fila ${index + 2}: Temporada debe tener formato YYYY-MM`);
      }
    });

    return errors;
  }

  // Exportar rankings a Excel
  async exportRankings(rankings, filename = 'rankings_export.xlsx') {
    const wb = XLSX.utils.book_new();
    
    // Preparar datos para exportar
    const data = rankings.map(ranking => ({
      'Usuario': ranking.player ? ranking.player.username : ranking.external_player_name,
      'Email': ranking.player ? ranking.player.email : ranking.external_player_email,
      'Es Externo': ranking.is_external ? 'Sí' : 'No',
      'Tipo': ranking.ranking_type,
      'Puntos': ranking.points,
      'Manos Jugadas': ranking.hands_played,
      'Torneos': ranking.tournaments_played,
      'Rake Total': ranking.total_rake,
      'Ganadas': ranking.wins,
      'Perdidas': ranking.losses,
      'Win Rate': ranking.win_rate + '%',
      'Posición': ranking.position,
      'Temporada': ranking.season,
      'Periodo': ranking.ranking_period,
      'Visible': ranking.is_visible ? 'Sí' : 'No',
      'Última Actualización': new Date(ranking.updated_at).toLocaleString()
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    
    // Ajustar anchos de columna
    const colWidths = data.length > 0 ? 
      Object.keys(data[0]).map(() => ({ wch: 15 })) : [];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Rankings');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  }
}

module.exports = new ExcelService();
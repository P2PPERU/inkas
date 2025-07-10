const RouletteCode = require('../models/RouletteCode.model');
const crypto = require('crypto');

// Generar código único
const generateUniqueCode = () => {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
};

// Crear código de ruleta
exports.createCode = async (req, res) => {
  try {
    const { prize, expiresIn } = req.body;
    
    let code;
    let codeExists = true;
    
    // Generar código único
    while (codeExists) {
      code = generateUniqueCode();
      codeExists = await RouletteCode.findOne({ code });
    }

    const expiresAt = expiresIn ? 
      new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000) : 
      null;

    const rouletteCode = await RouletteCode.create({
      code,
      prize,
      createdBy: req.user.id,
      expiresAt
    });

    res.status(201).json({
      success: true,
      code: rouletteCode
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al crear código',
      error: error.message 
    });
  }
};

// Usar código de ruleta
exports.useCode = async (req, res) => {
  try {
    const { code } = req.body;

    const rouletteCode = await RouletteCode.findOne({ 
      code: code.toUpperCase(),
      isActive: true,
      usedBy: null
    });

    if (!rouletteCode) {
      return res.status(404).json({ 
        message: 'Código inválido o ya utilizado' 
      });
    }

    // Verificar expiración
    if (rouletteCode.expiresAt && rouletteCode.expiresAt < Date.now()) {
      return res.status(400).json({ 
        message: 'Código expirado' 
      });
    }

    // Marcar como usado
    rouletteCode.usedBy = req.user.id;
    rouletteCode.usedAt = Date.now();
    rouletteCode.isActive = false;
    await rouletteCode.save();

    // Aquí aplicarías el premio al usuario
    // Por ejemplo: actualizar balance, agregar bonus, etc.

    res.json({
      success: true,
      message: 'Código canjeado exitosamente',
      prize: rouletteCode.prize
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al usar código',
      error: error.message 
    });
  }
};

// Listar códigos (admin/agent)
exports.getCodes = async (req, res) => {
  try {
    const { status = 'all', page = 1, limit = 10 } = req.query;
    
    let filter = {};
    
    // Si es agente, solo ver sus códigos
    if (req.user.role === 'agent') {
      filter.createdBy = req.user.id;
    }
    
    if (status !== 'all') {
      filter.isActive = status === 'active';
    }

    const codes = await RouletteCode.find(filter)
      .populate('createdBy', 'username')
      .populate('usedBy', 'username')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await RouletteCode.countDocuments(filter);

    res.json({
      success: true,
      codes,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al obtener códigos',
      error: error.message 
    });
  }
};
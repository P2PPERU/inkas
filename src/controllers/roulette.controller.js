const { 
  RoulettePrize, 
  RouletteSpin, 
  RouletteCode,
  User, 
  Bonus 
} = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../models').sequelize;
const crypto = require('crypto');

// ==================== FUNCIONES AUXILIARES ====================

// Generar código único
const generateUniqueCode = async () => {
  let code;
  let exists = true;
  
  while (exists) {
    code = crypto.randomBytes(4).toString('hex').toUpperCase();
    exists = await RouletteCode.findOne({ where: { code } });
  }
  
  return code;
};

// Calcular premio basado en probabilidades
const calculatePrize = async () => {
  const prizes = await RoulettePrize.findAll({
    where: { is_active: true },
    order: [['position', 'ASC']]
  });

  if (prizes.length === 0) {
    throw new Error('No hay premios configurados');
  }

  // Crear array de rangos de probabilidad
  let cumulativeProbability = 0;
  const prizeRanges = prizes.map(prize => {
    const range = {
      prize,
      min: cumulativeProbability,
      max: cumulativeProbability + parseFloat(prize.probability)
    };
    cumulativeProbability = range.max;
    return range;
  });

  // Generar número aleatorio entre 0 y 100
  const random = Math.random() * 100;

  // Encontrar el premio correspondiente
  const selectedRange = prizeRanges.find(range => 
    random >= range.min && random < range.max
  );

  return selectedRange ? selectedRange.prize : prizes[0];
};

// ==================== ENDPOINTS PÚBLICOS (USUARIO) ====================

// Obtener estado de giros del usuario
exports.getMySpinStatus = async (req, res) => {
  try {
    const status = await RouletteSpin.getUserSpinStatus(req.user.id);
    
    // Obtener premio demo si existe
    let demoPrize = null;
    if (status.demo_spin_done) {
      const demoSpin = await RouletteSpin.findOne({
        where: {
          user_id: req.user.id,
          spin_type: 'demo'
        },
        include: [{
          model: RoulettePrize,
          as: 'prize',
          attributes: ['name', 'prize_type', 'prize_value', 'color']
        }]
      });
      demoPrize = demoSpin?.prize;
    }

    res.json({
      success: true,
      status: {
        ...status,
        demo_prize: demoPrize
      }
    });
  } catch (error) {
    console.error('Error al obtener estado de giros:', error);
    res.status(500).json({ 
      message: 'Error al obtener estado de giros',
      error: error.message 
    });
  }
};

// Ejecutar giro
exports.spin = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const user = await User.findByPk(req.user.id, { transaction: t });
    
    // Determinar tipo de giro
    let spinType = null;
    let isRealPrize = false;

    // 1. Verificar si es giro demo
    if (!user.first_spin_demo_used) {
      spinType = 'demo';
      isRealPrize = false;
    }
    // 2. Verificar si es giro real de bienvenida
    else if (user.real_spin_available && user.validated_for_spin) {
      spinType = 'welcome_real';
      isRealPrize = true;
    }
    // 3. Verificar si tiene bonus de giro
    else {
      const spinBonus = await Bonus.findOne({
        where: {
          assigned_to: req.user.id,
          type: 'roulette_spin',
          status: 'active'
        },
        transaction: t
      });
      
      if (spinBonus) {
        spinType = 'bonus';
        isRealPrize = true;
        // Marcar bonus como usado
        spinBonus.status = 'claimed';
        spinBonus.claimed_at = new Date();
        await spinBonus.save({ transaction: t });
      }
    }

    if (!spinType) {
      await t.rollback();
      return res.status(400).json({ 
        message: 'No tienes giros disponibles' 
      });
    }

    // Calcular premio
    const prize = await calculatePrize();

    // Crear registro del giro
    const spin = await RouletteSpin.create({
      user_id: req.user.id,
      prize_id: prize.id,
      spin_type: spinType,
      is_real_prize: isRealPrize,
      prize_status: isRealPrize ? 'pending_validation' : 'demo',
      spin_date: new Date()
    }, { transaction: t });

    // Actualizar flags del usuario según el tipo
    if (spinType === 'demo') {
      user.first_spin_demo_used = true;
      await user.save({ transaction: t });
    } else if (spinType === 'welcome_real') {
      user.real_spin_available = false;
      await user.save({ transaction: t });
      
      // Aplicar premio según el comportamiento definido
      if (prize.prize_behavior === 'instant_cash') {
        // Dinero directo al balance
        user.balance = parseFloat(user.balance) + parseFloat(prize.prize_value);
        await user.save({ transaction: t });
        
        spin.prize_status = 'applied';
        spin.validated_at = new Date();
        await spin.save({ transaction: t });
      } else if (prize.prize_behavior === 'bonus') {
        // Crear bonus según configuración
        const bonusConfig = prize.custom_config || {};
        
        await Bonus.create({
          name: bonusConfig.bonus_name || `Premio Ruleta: ${prize.name}`,
          description: prize.description || 'Premio ganado en la ruleta',
          type: bonusConfig.bonus_type || 'custom',
          amount: bonusConfig.fixed_amount || 0,
          percentage: bonusConfig.percentage || 0,
          max_bonus: prize.prize_value,
          min_deposit: bonusConfig.min_deposit || 0,
          assigned_to: req.user.id,
          assigned_by: user.spin_validated_by || req.user.id,
          status: 'active',
          valid_until: new Date(Date.now() + (bonusConfig.validity_days || 30) * 24 * 60 * 60 * 1000)
        }, { transaction: t });
        
        spin.prize_status = 'applied';
        spin.validated_at = new Date();
        await spin.save({ transaction: t });
      } else if (prize.prize_behavior === 'custom' && prize.custom_config.auto_apply) {
        // Comportamiento personalizado automático
        // Aquí puedes agregar lógica personalizada según custom_config
        
        spin.prize_status = 'applied';
        spin.validated_at = new Date();
        await spin.save({ transaction: t });
      }
      // Si es 'manual' o 'custom' sin auto_apply, se mantiene como pending_validation
    }

    await t.commit();

    // Preparar respuesta
    const response = {
      success: true,
      spin: {
        id: spin.id,
        type: spinType,
        is_real: isRealPrize,
        prize: {
          name: prize.name,
          type: prize.prize_type,
          value: prize.prize_value,
          color: prize.color,
          position: prize.position
        }
      }
    };

    // Agregar mensaje según el tipo
    if (spinType === 'demo') {
      response.message = '¡Este es un premio de ejemplo! Juega en nuestras mesas para activar tu giro real.';
    } else {
      response.message = `¡Felicidades! Has ganado: ${prize.name}`;
      if (prize.prize_behavior === 'instant_cash') {
        response.message += ` - $${prize.prize_value} ya fue agregado a tu balance.`;
      }
    }

    res.json(response);
  } catch (error) {
    await t.rollback();
    console.error('Error al ejecutar giro:', error);
    res.status(500).json({ 
      message: 'Error al ejecutar giro',
      error: error.message 
    });
  }
};

// Obtener historial de giros
exports.getMySpinHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows: spins } = await RouletteSpin.findAndCountAll({
      where: { user_id: req.user.id },
      include: [{
        model: RoulettePrize,
        as: 'prize',
        attributes: ['name', 'prize_type', 'prize_value', 'color']
      }],
      order: [['spin_date', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    res.json({
      success: true,
      spins,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ 
      message: 'Error al obtener historial',
      error: error.message 
    });
  }
};

// Validar y usar código
exports.validateCode = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ 
        message: 'Código requerido' 
      });
    }

    const rouletteCode = await RouletteCode.findOne({ 
      where: { 
        code: code.toUpperCase(),
        is_active: true,
        used_by: null
      }
    });

    if (!rouletteCode) {
      await t.rollback();
      return res.status(404).json({ 
        message: 'Código inválido o ya utilizado' 
      });
    }

    // Verificar expiración
    if (rouletteCode.expires_at && rouletteCode.expires_at < new Date()) {
      await t.rollback();
      return res.status(400).json({ 
        message: 'Código expirado' 
      });
    }

    // Marcar código como usado
    rouletteCode.used_by = req.user.id;
    rouletteCode.used_at = new Date();
    rouletteCode.is_active = false;
    await rouletteCode.save({ transaction: t });

    // Crear bonus de giro
    await Bonus.create({
      name: 'Giro de Ruleta - Código',
      description: rouletteCode.description || 'Giro obtenido mediante código',
      type: 'roulette_spin',
      amount: 0, // Los giros no tienen valor monetario
      assigned_to: req.user.id,
      assigned_by: rouletteCode.created_by,
      status: 'active'
    }, { transaction: t });

    await t.commit();

    res.json({
      success: true,
      message: '¡Código válido! Tienes un nuevo giro disponible.'
    });
  } catch (error) {
    await t.rollback();
    console.error('Error al validar código:', error);
    res.status(500).json({ 
      message: 'Error al validar código',
      error: error.message 
    });
  }
};

// ==================== ENDPOINTS DE ADMIN ====================

// Obtener configuración completa de la ruleta
exports.getRouletteConfig = async (req, res) => {
  try {
    // Obtener todos los premios ordenados por posición
    const prizes = await RoulettePrize.findAll({
      where: { is_active: true },
      order: [['position', 'ASC']],
      include: [{
        model: User,
        as: 'creator',
        attributes: ['username']
      }]
    });

    // Validar probabilidades
    const validation = await RoulettePrize.validateProbabilities();

    // Obtener estadísticas rápidas
    const stats = {
      totalPrizes: prizes.length,
      totalProbability: validation.total,
      isValid: validation.isValid,
      maxPositions: 20,
      usedPositions: prizes.map(p => p.position),
      availablePositions: Array.from({length: 20}, (_, i) => i + 1)
        .filter(pos => !prizes.some(p => p.position === pos))
    };

    res.json({
      success: true,
      config: {
        prizes,
        validation,
        stats
      }
    });
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    res.status(500).json({ 
      message: 'Error al obtener configuración de ruleta',
      error: error.message 
    });
  }
};

// Obtener configuración de premios
exports.getPrizes = async (req, res) => {
  try {
    const prizes = await RoulettePrize.findAll({
      include: [{
        model: User,
        as: 'creator',
        attributes: ['username']
      }],
      order: [['position', 'ASC']]
    });

    // Validar probabilidades
    const validation = await RoulettePrize.validateProbabilities();

    res.json({
      success: true,
      prizes,
      probability_validation: validation
    });
  } catch (error) {
    console.error('Error al obtener premios:', error);
    res.status(500).json({ 
      message: 'Error al obtener premios',
      error: error.message 
    });
  }
};

// Crear premio
exports.createPrize = async (req, res) => {
  try {
    const prizeData = {
      ...req.body,
      created_by: req.user.id
    };

    const prize = await RoulettePrize.create(prizeData);

    res.status(201).json({
      success: true,
      prize
    });
  } catch (error) {
    console.error('Error al crear premio:', error);
    res.status(500).json({ 
      message: 'Error al crear premio',
      error: error.message 
    });
  }
};

// Actualizar premio
exports.updatePrize = async (req, res) => {
  try {
    const { id } = req.params;
    const prize = await RoulettePrize.findByPk(id);

    if (!prize) {
      return res.status(404).json({ 
        message: 'Premio no encontrado' 
      });
    }

    await prize.update(req.body);

    res.json({
      success: true,
      prize
    });
  } catch (error) {
    console.error('Error al actualizar premio:', error);
    res.status(500).json({ 
      message: 'Error al actualizar premio',
      error: error.message 
    });
  }
};

// Eliminar premio (solo desactivar)
exports.deletePrize = async (req, res) => {
  try {
    const { id } = req.params;
    const prize = await RoulettePrize.findByPk(id);

    if (!prize) {
      return res.status(404).json({ 
        message: 'Premio no encontrado' 
      });
    }

    prize.is_active = false;
    await prize.save();

    res.json({
      success: true,
      message: 'Premio desactivado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar premio:', error);
    res.status(500).json({ 
      message: 'Error al eliminar premio',
      error: error.message 
    });
  }
};

// Ajustar probabilidades de todos los premios
exports.adjustProbabilities = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { probabilities } = req.body;
    
    // Validar que se enviaron probabilidades
    if (!probabilities || !Array.isArray(probabilities)) {
      return res.status(400).json({ 
        message: 'Se requiere un array de probabilidades' 
      });
    }
    
    // Validar que suman 100
    const total = probabilities.reduce((sum, item) => sum + parseFloat(item.probability), 0);
    if (Math.abs(total - 100) > 0.01) {
      return res.status(400).json({ 
        message: `Las probabilidades deben sumar 100%. Total actual: ${total}%` 
      });
    }
    
    // Actualizar cada premio
    for (const item of probabilities) {
      await RoulettePrize.update(
        { probability: item.probability },
        { 
          where: { id: item.prize_id },
          transaction: t 
        }
      );
    }
    
    await t.commit();
    
    // Obtener premios actualizados
    const updatedPrizes = await RoulettePrize.findAll({
      where: { is_active: true },
      order: [['position', 'ASC']]
    });
    
    res.json({
      success: true,
      message: 'Probabilidades actualizadas exitosamente',
      prizes: updatedPrizes
    });
  } catch (error) {
    await t.rollback();
    console.error('Error al ajustar probabilidades:', error);
    res.status(500).json({ 
      message: 'Error al ajustar probabilidades',
      error: error.message 
    });
  }
};

// Reordenar premios (cambiar posiciones)
exports.reorderPrizes = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { prizes } = req.body;
    
    // Validar que no haya posiciones duplicadas
    const positions = prizes.map(p => p.position);
    const uniquePositions = [...new Set(positions)];
    
    if (positions.length !== uniquePositions.length) {
      return res.status(400).json({ 
        message: 'No puede haber posiciones duplicadas' 
      });
    }
    
    // Actualizar posiciones
    for (const prizeUpdate of prizes) {
      await RoulettePrize.update(
        { position: prizeUpdate.position },
        { 
          where: { id: prizeUpdate.id },
          transaction: t 
        }
      );
    }
    
    await t.commit();
    
    // Obtener premios actualizados
    const updatedPrizes = await RoulettePrize.findAll({
      where: { is_active: true },
      order: [['position', 'ASC']]
    });
    
    res.json({
      success: true,
      message: 'Posiciones actualizadas exitosamente',
      prizes: updatedPrizes
    });
  } catch (error) {
    await t.rollback();
    console.error('Error al reordenar premios:', error);
    res.status(500).json({ 
      message: 'Error al reordenar premios',
      error: error.message 
    });
  }
};

// Clonar premio existente
exports.clonePrize = async (req, res) => {
  try {
    const { id } = req.params;
    const { position } = req.body;
    
    const originalPrize = await RoulettePrize.findByPk(id);
    
    if (!originalPrize) {
      return res.status(404).json({ 
        message: 'Premio no encontrado' 
      });
    }
    
    // Verificar que la posición esté disponible
    const positionTaken = await RoulettePrize.findOne({
      where: { position, is_active: true }
    });
    
    if (positionTaken) {
      return res.status(400).json({ 
        message: 'La posición ya está ocupada' 
      });
    }
    
    // Crear clon
    const clonedPrize = await RoulettePrize.create({
      name: `${originalPrize.name} (Copia)`,
      description: originalPrize.description,
      prize_type: originalPrize.prize_type,
      prize_behavior: originalPrize.prize_behavior,
      custom_config: originalPrize.custom_config,
      prize_value: originalPrize.prize_value,
      prize_metadata: originalPrize.prize_metadata,
      probability: 0, // Iniciar con 0 para que el admin ajuste
      color: originalPrize.color,
      position,
      min_deposit_required: originalPrize.min_deposit_required,
      created_by: req.user.id
    });
    
    res.status(201).json({
      success: true,
      message: 'Premio clonado exitosamente',
      prize: clonedPrize
    });
  } catch (error) {
    console.error('Error al clonar premio:', error);
    res.status(500).json({ 
      message: 'Error al clonar premio',
      error: error.message 
    });
  }
};

// Actualización masiva de premios
exports.bulkUpdatePrizes = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { prizes } = req.body;
    
    // Validar que las probabilidades sumen 100
    const totalProbability = prizes.reduce((sum, p) => sum + parseFloat(p.probability), 0);
    if (Math.abs(totalProbability - 100) > 0.01) {
      return res.status(400).json({ 
        message: `Las probabilidades deben sumar 100%. Total actual: ${totalProbability}%` 
      });
    }
    
    // Actualizar cada premio
    for (const prizeData of prizes) {
      const { id, ...updateData } = prizeData;
      
      await RoulettePrize.update(
        updateData,
        { 
          where: { id },
          transaction: t 
        }
      );
    }
    
    await t.commit();
    
    // Obtener premios actualizados
    const updatedPrizes = await RoulettePrize.findAll({
      where: { is_active: true },
      order: [['position', 'ASC']]
    });
    
    res.json({
      success: true,
      message: 'Premios actualizados exitosamente',
      prizes: updatedPrizes
    });
  } catch (error) {
    await t.rollback();
    console.error('Error en actualización masiva:', error);
    res.status(500).json({ 
      message: 'Error en actualización masiva',
      error: error.message 
    });
  }
};

// Activar/Desactivar múltiples premios
exports.togglePrizesStatus = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { prizeIds, isActive } = req.body;
    
    await RoulettePrize.update(
      { is_active: isActive },
      { 
        where: { id: { [Op.in]: prizeIds } },
        transaction: t 
      }
    );
    
    await t.commit();
    
    res.json({
      success: true,
      message: `${prizeIds.length} premios ${isActive ? 'activados' : 'desactivados'} exitosamente`
    });
  } catch (error) {
    await t.rollback();
    console.error('Error al cambiar estado de premios:', error);
    res.status(500).json({ 
      message: 'Error al cambiar estado de premios',
      error: error.message 
    });
  }
};

// Restablecer configuración por defecto
exports.resetToDefaultPrizes = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    // Desactivar todos los premios actuales
    await RoulettePrize.update(
      { is_active: false },
      { 
        where: { is_active: true },
        transaction: t 
      }
    );
    
    // Crear premios por defecto
    const defaultPrizes = [
      {
        name: 'Sigue Intentando',
        description: 'Mejor suerte la próxima vez',
        prize_type: 'none',
        prize_behavior: 'manual',
        prize_value: 0,
        probability: 40,
        color: '#808080',
        position: 1
      },
      {
        name: '$10 Cash',
        description: 'Gana $10 directo a tu balance',
        prize_type: 'cash',
        prize_behavior: 'instant_cash',
        prize_value: 10,
        probability: 25,
        color: '#00FF00',
        position: 2
      },
      {
        name: '$25 Cash',
        description: 'Gana $25 directo a tu balance',
        prize_type: 'cash',
        prize_behavior: 'instant_cash',
        prize_value: 25,
        probability: 15,
        color: '#00AA00',
        position: 3
      },
      {
        name: '50% Bonus',
        description: '50% de bonus en tu próximo depósito hasta $100',
        prize_type: 'bonus',
        prize_behavior: 'bonus',
        prize_value: 100,
        probability: 10,
        color: '#FFA500',
        position: 4,
        custom_config: {
          bonus_name: 'Bonus Ruleta 50%',
          bonus_type: 'deposit',
          percentage: 50,
          min_deposit: 20,
          max_bonus: 100,
          validity_days: 7
        }
      },
      {
        name: '$50 Cash',
        description: 'Gana $50 directo a tu balance',
        prize_type: 'cash',
        prize_behavior: 'instant_cash',
        prize_value: 50,
        probability: 7,
        color: '#007700',
        position: 5
      },
      {
        name: '$100 Cash',
        description: '¡Gran Premio! $100 directo a tu balance',
        prize_type: 'cash',
        prize_behavior: 'instant_cash',
        prize_value: 100,
        probability: 3,
        color: '#FFD700',
        position: 6
      }
    ];
    
    for (const prizeData of defaultPrizes) {
      await RoulettePrize.create({
        ...prizeData,
        created_by: req.user.id
      }, { transaction: t });
    }
    
    await t.commit();
    
    const newPrizes = await RoulettePrize.findAll({
      where: { is_active: true },
      order: [['position', 'ASC']]
    });
    
    res.json({
      success: true,
      message: 'Configuración restablecida a valores por defecto',
      prizes: newPrizes
    });
  } catch (error) {
    await t.rollback();
    console.error('Error al restablecer configuración:', error);
    res.status(500).json({ 
      message: 'Error al restablecer configuración',
      error: error.message 
    });
  }
};

// Previsualizar ruleta con configuración actual
exports.previewRoulette = async (req, res) => {
  try {
    const prizes = await RoulettePrize.findAll({
      where: { is_active: true },
      order: [['position', 'ASC']],
      attributes: ['id', 'name', 'color', 'position', 'probability', 'prize_value', 'prize_type']
    });
    
    if (prizes.length === 0) {
      return res.status(400).json({ 
        message: 'No hay premios configurados' 
      });
    }
    
    // Generar configuración para el frontend
    const wheelConfig = {
      segments: prizes.map(prize => ({
        id: prize.id,
        text: prize.name,
        fillStyle: prize.color,
        textFillStyle: '#FFFFFF',
        probability: parseFloat(prize.probability)
      })),
      animation: {
        type: 'spinToStop',
        duration: 5,
        spins: 8,
        callbackFinished: 'alertPrize'
      },
      pins: {
        number: prizes.length * 2
      }
    };
    
    res.json({
      success: true,
      config: wheelConfig,
      prizes: prizes
    });
  } catch (error) {
    console.error('Error al generar preview:', error);
    res.status(500).json({ 
      message: 'Error al generar preview',
      error: error.message 
    });
  }
};

// Exportar configuración
exports.exportConfig = async (req, res) => {
  try {
    const prizes = await RoulettePrize.findAll({
      where: { is_active: true },
      order: [['position', 'ASC']],
      attributes: { exclude: ['id', 'created_by', 'created_at', 'updated_at'] }
    });
    
    const config = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      prizes: prizes
    };
    
    res.json({
      success: true,
      config: config
    });
  } catch (error) {
    console.error('Error al exportar configuración:', error);
    res.status(500).json({ 
      message: 'Error al exportar configuración',
      error: error.message 
    });
  }
};

// Importar configuración
exports.importConfig = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { config, replaceExisting = false } = req.body;
    
    if (!config.prizes || !Array.isArray(config.prizes)) {
      return res.status(400).json({ 
        message: 'Configuración inválida' 
      });
    }
    
    // Si se debe reemplazar, desactivar premios existentes
    if (replaceExisting) {
      await RoulettePrize.update(
        { is_active: false },
        { 
          where: { is_active: true },
          transaction: t 
        }
      );
    }
    
    // Importar nuevos premios
    for (const prizeData of config.prizes) {
      await RoulettePrize.create({
        ...prizeData,
        created_by: req.user.id
      }, { transaction: t });
    }
    
    await t.commit();
    
    const newPrizes = await RoulettePrize.findAll({
      where: { is_active: true },
      order: [['position', 'ASC']]
    });
    
    res.json({
      success: true,
      message: 'Configuración importada exitosamente',
      prizes: newPrizes
    });
  } catch (error) {
    await t.rollback();
    console.error('Error al importar configuración:', error);
    res.status(500).json({ 
      message: 'Error al importar configuración',
      error: error.message 
    });
  }
};

// Obtener usuarios pendientes de validación
exports.getPendingValidations = async (req, res) => {
  try {
    const pendingUsers = await User.findAll({
      where: {
        first_spin_demo_used: true,
        validated_for_spin: false
      },
      attributes: [
        'id', 
        'username', 
        'email', 
        'created_at',
        'first_spin_demo_used',
        'validated_for_spin'
      ],
      include: [
        {
          model: RouletteSpin,
          as: 'rouletteSpins',
          where: { spin_type: 'demo' },
          required: false,
          include: [{
            model: RoulettePrize,
            as: 'prize',
            attributes: ['name', 'prize_type', 'prize_value']
          }]
        },
        {
          model: User,
          as: 'parentAgent',
          attributes: ['username']
        }
      ],
      order: [['created_at', 'ASC']]
    });

    res.json({
      success: true,
      users: pendingUsers
    });
  } catch (error) {
    console.error('Error al obtener validaciones pendientes:', error);
    res.status(500).json({ 
      message: 'Error al obtener validaciones pendientes',
      error: error.message 
    });
  }
};

// Validar usuario para giro real
exports.validateUserSpin = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { userId } = req.params;
    const { notes } = req.body;

    const user = await User.findByPk(userId);

    if (!user) {
      await t.rollback();
      return res.status(404).json({ 
        message: 'Usuario no encontrado' 
      });
    }

    if (user.validated_for_spin) {
      await t.rollback();
      return res.status(400).json({ 
        message: 'Usuario ya validado' 
      });
    }

    // Actualizar usuario
    user.validated_for_spin = true;
    user.real_spin_available = true;
    user.spin_validated_by = req.user.id;
    user.spin_validated_at = new Date();
    await user.save({ transaction: t });

    // Agregar nota si existe
    if (notes) {
      await RouletteSpin.update(
        { notes },
        {
          where: {
            user_id: userId,
            spin_type: 'demo'
          },
          transaction: t
        }
      );
    }

    await t.commit();

    res.json({
      success: true,
      message: 'Usuario validado exitosamente. Ahora puede usar su giro real.'
    });
  } catch (error) {
    await t.rollback();
    console.error('Error al validar usuario:', error);
    res.status(500).json({ 
      message: 'Error al validar usuario',
      error: error.message 
    });
  }
};

// Validación en lote
exports.validateBatch = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ 
        message: 'Se requiere un array de IDs de usuario' 
      });
    }

    const updateResult = await User.update(
      {
        validated_for_spin: true,
        real_spin_available: true,
        spin_validated_by: req.user.id,
        spin_validated_at: new Date()
      },
      {
        where: {
          id: { [Op.in]: userIds },
          validated_for_spin: false
        },
        transaction: t
      }
    );

    await t.commit();

    res.json({
      success: true,
      message: `${updateResult[0]} usuarios validados exitosamente`
    });
  } catch (error) {
    await t.rollback();
    console.error('Error en validación por lote:', error);
    res.status(500).json({ 
      message: 'Error en validación por lote',
      error: error.message 
    });
  }
};

// ==================== ENDPOINTS DE CÓDIGOS (AGENT/ADMIN) ====================

// Crear código de ruleta
exports.createCode = async (req, res) => {
  try {
    const { description, expiresIn, quantity = 1 } = req.body;
    
    const codes = [];
    const expiresAt = expiresIn ? 
      new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000) : 
      null;

    for (let i = 0; i < quantity; i++) {
      const code = await generateUniqueCode();
      
      const rouletteCode = await RouletteCode.create({
        code,
        description,
        grants_spin: true,
        created_by: req.user.id,
        expires_at: expiresAt
      });

      codes.push(rouletteCode);
    }

    res.status(201).json({
      success: true,
      codes
    });
  } catch (error) {
    console.error('Error al crear código:', error);
    res.status(500).json({ 
      message: 'Error al crear código',
      error: error.message 
    });
  }
};

// Listar códigos
exports.getCodes = async (req, res) => {
  try {
    const { status = 'all', page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    const whereConditions = {};
    
    // Si es agente, solo ver sus códigos
    if (req.user.role === 'agent') {
      whereConditions.created_by = req.user.id;
    }
    
    if (status !== 'all') {
      whereConditions.is_active = status === 'active';
    }

    const { count, rows: codes } = await RouletteCode.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['username']
        },
        {
          model: User,
          as: 'usedBy',
          attributes: ['username']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    res.json({
      success: true,
      codes,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('Error al obtener códigos:', error);
    res.status(500).json({ 
      message: 'Error al obtener códigos',
      error: error.message 
    });
  }
};

// ==================== ESTADÍSTICAS ====================

// Obtener estadísticas de la ruleta
exports.getStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter = {};
    if (startDate) dateFilter[Op.gte] = new Date(startDate);
    if (endDate) dateFilter[Op.lte] = new Date(endDate);

    // Total de giros por tipo
    const spinsByType = await RouletteSpin.findAll({
      where: {
        ...(Object.keys(dateFilter).length && { 
          spin_date: dateFilter 
        })
      },
      attributes: [
        'spin_type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['spin_type']
    });

    // Premios más ganados
    const topPrizes = await RouletteSpin.findAll({
      where: {
        is_real_prize: true,
        ...(Object.keys(dateFilter).length && { 
          spin_date: dateFilter 
        })
      },
      include: [{
        model: RoulettePrize,
        as: 'prize',
        attributes: ['name', 'prize_type', 'prize_value']
      }],
      attributes: [
        'prize_id',
        [sequelize.fn('COUNT', sequelize.col('prize_id')), 'count']
      ],
      group: ['prize_id', 'prize.id'],
      order: [[sequelize.fn('COUNT', sequelize.col('prize_id')), 'DESC']],
      limit: 10
    });

    // Usuarios con más giros
    const topSpinners = await RouletteSpin.findAll({
      where: {
        ...(Object.keys(dateFilter).length && { 
          spin_date: dateFilter 
        })
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['username']
      }],
      attributes: [
        'user_id',
        [sequelize.fn('COUNT', sequelize.col('user_id')), 'spins']
      ],
      group: ['user_id', 'user.id'],
      order: [[sequelize.fn('COUNT', sequelize.col('user_id')), 'DESC']],
      limit: 10
    });

    // Validaciones pendientes
    const pendingValidations = await User.count({
      where: {
        first_spin_demo_used: true,
        validated_for_spin: false
      }
    });

    // Valor total otorgado
    const totalValueAwarded = await RouletteSpin.sum('prize.prize_value', {
      where: {
        is_real_prize: true,
        prize_status: 'applied',
        ...(Object.keys(dateFilter).length && { 
          spin_date: dateFilter 
        })
      },
      include: [{
        model: RoulettePrize,
        as: 'prize'
      }]
    });

    res.json({
      success: true,
      stats: {
        spinsByType: spinsByType.map(s => ({
          type: s.spin_type,
          count: parseInt(s.dataValues.count)
        })),
        topPrizes: topPrizes.map(p => ({
          prize: p.prize,
          count: parseInt(p.dataValues.count)
        })),
        topSpinners: topSpinners.map(s => ({
          user: s.user.username,
          spins: parseInt(s.dataValues.spins)
        })),
        pendingValidations,
        totalValueAwarded: totalValueAwarded || 0
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
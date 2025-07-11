const { AffiliateProfile, AffiliateCode, User, AffiliationHistory } = require('../models');
const { Op } = require('sequelize');
const crypto = require('crypto');
const sequelize = require('../models').sequelize;

// Generar código único
const generateUniqueCode = async (prefix = '') => {
  let code;
  let exists = true;
  
  while (exists) {
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    code = prefix + random;
    
    exists = await AffiliateCode.findOne({ where: { code } });
  }
  
  return code;
};

// Obtener perfil de afiliado
exports.getAffiliateProfile = async (req, res) => {
  try {
    const affiliateProfile = await AffiliateProfile.findOne({
      where: { user_id: req.user.id },
      include: [
        {
          model: AffiliateCode,
          as: 'codes',
          order: [['created_at', 'DESC']]
        }
      ]
    });

    if (!affiliateProfile) {
      return res.status(404).json({ 
        message: 'Perfil de afiliado no encontrado' 
      });
    }

    res.json({
      success: true,
      profile: affiliateProfile
    });
  } catch (error) {
    console.error('Error al obtener perfil de afiliado:', error);
    res.status(500).json({ 
      message: 'Error al obtener perfil de afiliado',
      error: error.message 
    });
  }
};

// Crear código de afiliación
exports.createAffiliateCode = async (req, res) => {
  try {
    const { description, bonusAmount, maxUses, expiresIn } = req.body;

    const affiliateProfile = await AffiliateProfile.findOne({
      where: { user_id: req.user.id }
    });

    if (!affiliateProfile) {
      return res.status(404).json({ 
        message: 'No tienes perfil de afiliado' 
      });
    }

    const code = await generateUniqueCode('AFF');
    const expiresAt = expiresIn ? 
      new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000) : 
      null;

    const affiliateCode = await AffiliateCode.create({
      affiliate_profile_id: affiliateProfile.id,
      code,
      description,
      bonus_amount: bonusAmount || 0,
      max_uses: maxUses || null,
      expires_at: expiresAt
    });

    res.status(201).json({
      success: true,
      code: affiliateCode
    });
  } catch (error) {
    console.error('Error al crear código de afiliación:', error);
    res.status(500).json({ 
      message: 'Error al crear código de afiliación',
      error: error.message 
    });
  }
};

// Listar códigos de afiliación
exports.getAffiliateCodes = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all' } = req.query;
    const offset = (page - 1) * limit;

    const affiliateProfile = await AffiliateProfile.findOne({
      where: { user_id: req.user.id }
    });

    if (!affiliateProfile) {
      return res.status(404).json({ 
        message: 'No tienes perfil de afiliado' 
      });
    }

    const whereConditions = {
      affiliate_profile_id: affiliateProfile.id
    };

    if (status === 'active') {
      whereConditions.is_active = true;
      whereConditions[Op.or] = [
        { expires_at: null },
        { expires_at: { [Op.gt]: new Date() } }
      ];
    } else if (status === 'expired') {
      whereConditions.expires_at = { [Op.lte]: new Date() };
    }

    const { count, rows: codes } = await AffiliateCode.findAndCountAll({
      where: whereConditions,
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

// Actualizar código de afiliación
exports.updateAffiliateCode = async (req, res) => {
  try {
    const { codeId } = req.params;
    const { description, isActive } = req.body;

    const affiliateProfile = await AffiliateProfile.findOne({
      where: { user_id: req.user.id }
    });

    const code = await AffiliateCode.findOne({
      where: {
        id: codeId,
        affiliate_profile_id: affiliateProfile.id
      }
    });

    if (!code) {
      return res.status(404).json({ 
        message: 'Código no encontrado' 
      });
    }

    if (description !== undefined) code.description = description;
    if (isActive !== undefined) code.is_active = isActive;

    await code.save();

    res.json({
      success: true,
      code
    });
  } catch (error) {
    console.error('Error al actualizar código:', error);
    res.status(500).json({ 
      message: 'Error al actualizar código',
      error: error.message 
    });
  }
};

// Obtener estadísticas de afiliación
exports.getAffiliateStats = async (req, res) => {
  try {
    const { period = '30d' } = req.query;

    // Calcular fecha de inicio según el período
    const startDate = new Date();
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case 'all':
        startDate.setFullYear(2000);
        break;
    }

    // Estadísticas de afiliaciones
    const affiliationStats = await AffiliationHistory.findAll({
      where: {
        agent_id: req.user.id,
        created_at: { [Op.gte]: startDate }
      },
      attributes: [
        [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('bonus_applied')), 'totalBonus']
      ],
      group: [sequelize.fn('DATE', sequelize.col('created_at'))],
      order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']]
    });

    // Códigos más usados
    const topCodes = await AffiliateCode.findAll({
      include: [{
        model: AffiliateProfile,
        as: 'affiliateProfile',
        where: { user_id: req.user.id },
        attributes: []
      }],
      where: {
        usage_count: { [Op.gt]: 0 }
      },
      order: [['usage_count', 'DESC']],
      limit: 5
    });

    // Resumen general
    const summary = await AffiliationHistory.findOne({
      where: { agent_id: req.user.id },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalReferrals'],
        [sequelize.fn('SUM', sequelize.col('bonus_applied')), 'totalBonusGiven']
      ]
    });

    res.json({
      success: true,
      stats: {
        chart: affiliationStats.map(stat => ({
          date: stat.dataValues.date,
          referrals: parseInt(stat.dataValues.count),
          bonus: parseFloat(stat.dataValues.totalBonus) || 0
        })),
        topCodes,
        summary: {
          totalReferrals: parseInt(summary?.dataValues.totalReferrals) || 0,
          totalBonusGiven: parseFloat(summary?.dataValues.totalBonusGiven) || 0
        }
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de afiliación:', error);
    res.status(500).json({ 
      message: 'Error al obtener estadísticas de afiliación',
      error: error.message 
    });
  }
};

// Obtener materiales de marketing
exports.getMarketingMaterials = async (req, res) => {
  try {
    const affiliateProfile = await AffiliateProfile.findOne({
      where: { user_id: req.user.id }
    });

    if (!affiliateProfile) {
      return res.status(404).json({ 
        message: 'No tienes perfil de afiliado' 
      });
    }

    // Generar links de referido
    const baseUrl = process.env.CLIENT_URL || 'https://inkaspoker.com';
    const materials = {
      referralLinks: {
        main: `${baseUrl}/register?ref=${affiliateProfile.affiliate_code}`,
        custom: affiliateProfile.custom_url,
        qrCode: `${baseUrl}/api/affiliate/qr/${affiliateProfile.affiliate_code}`
      },
      banners: [
        {
          size: '728x90',
          url: `${baseUrl}/banners/${affiliateProfile.affiliate_code}-728x90.jpg`
        },
        {
          size: '300x250',
          url: `${baseUrl}/banners/${affiliateProfile.affiliate_code}-300x250.jpg`
        },
        {
          size: '160x600',
          url: `${baseUrl}/banners/${affiliateProfile.affiliate_code}-160x600.jpg`
        }
      ],
      embedCode: `<a href="${baseUrl}/register?ref=${affiliateProfile.affiliate_code}" target="_blank">
  <img src="${baseUrl}/banners/${affiliateProfile.affiliate_code}-728x90.jpg" alt="Únete a Inkas Poker" />
</a>`,
      socialMediaTemplates: [
        {
          platform: 'whatsapp',
          message: `¡Únete a Inkas Poker con mi código ${affiliateProfile.affiliate_code} y obtén $50 de bonus! 🎰 ${baseUrl}/register?ref=${affiliateProfile.affiliate_code}`
        },
        {
          platform: 'facebook',
          message: `🎯 ¿Buscas acción en el poker? Regístrate en Inkas Poker con mi código ${affiliateProfile.affiliate_code} y recibe $50 de bonus de bienvenida. ¡No te lo pierdas! ${baseUrl}/register?ref=${affiliateProfile.affiliate_code}`
        }
      ]
    };

    res.json({
      success: true,
      materials
    });
  } catch (error) {
    console.error('Error al obtener materiales de marketing:', error);
    res.status(500).json({ 
      message: 'Error al obtener materiales de marketing',
      error: error.message 
    });
  }
};
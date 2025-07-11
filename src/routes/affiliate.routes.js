const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const affiliateController = require('../controllers/affiliate.controller');
const { protect } = require('../middlewares/auth.middleware');
const { isAgent } = require('../middlewares/roleCheck');

// Validaciones
const validateAffiliateCode = [
  body('description')
    .optional()
    .trim()
    .isLength({ min: 3 })
    .withMessage('La descripción debe tener al menos 3 caracteres'),
  body('bonusAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El monto del bonus debe ser positivo'),
  body('maxUses')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El número máximo de usos debe ser al menos 1'),
  body('expiresIn')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Los días de expiración deben ser al menos 1')
];

// Todas las rutas requieren autenticación y rol de agente
router.use(protect, isAgent);

// Perfil de afiliado
router.get('/profile', affiliateController.getAffiliateProfile);

// Códigos de afiliación
router.get('/codes', affiliateController.getAffiliateCodes);
router.post('/codes', validateAffiliateCode, affiliateController.createAffiliateCode);
router.put('/codes/:codeId', affiliateController.updateAffiliateCode);

// Estadísticas
router.get('/stats', affiliateController.getAffiliateStats);

// Materiales de marketing
router.get('/marketing', affiliateController.getMarketingMaterials);

module.exports = router;
// src/routes/agent.routes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const agentController = require('../controllers/agent.controller');
const { protect } = require('../middlewares/auth.middleware');
const { isAgent } = require('../middlewares/roleCheck');

// Validaciones
const validateClient = [
  body('username')
    .trim()
    .isLength({ min: 3 })
    .withMessage('Username debe tener al menos 3 caracteres'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Contraseña debe tener al menos 6 caracteres')
];

// Todas las rutas requieren autenticación y rol de agente
router.use(protect, isAgent);

// Gestión de clientes
router.get('/clients', agentController.getMyClients);
router.post('/clients', validateClient, agentController.createClient);
router.put('/clients/:clientId', agentController.updateClient);

// Bonificaciones
router.post('/clients/:clientId/bonus', agentController.assignBonusToClient);

// Estadísticas y dashboard
router.get('/stats', agentController.getAgentStats);
router.get('/activity', agentController.getRecentActivity);
router.get('/dashboard', agentController.getAgentDashboard);

module.exports = router;
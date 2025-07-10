// src/middlewares/validation.middleware.js
const { validationResult } = require('express-validator');

exports.handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.param,
      message: error.msg
    }));

    return res.status(400).json({
      success: false,
      errors: errorMessages
    });
  }
  
  next();
};

// Validadores personalizados
exports.isMongoId = (value) => {
  const mongoIdRegex = /^[0-9a-fA-F]{24}$/;
  if (!mongoIdRegex.test(value)) {
    throw new Error('ID inválido');
  }
  return true;
};

exports.isStrongPassword = (value) => {
  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!strongPasswordRegex.test(value)) {
    throw new Error('La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial');
  }
  return true;
};
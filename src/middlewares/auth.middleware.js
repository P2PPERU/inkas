const jwt = require('jsonwebtoken');
const { User } = require('../models');

exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && 
      req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ 
      message: 'No autorizado para acceder a esta ruta' 
    });
  }

  try {
    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Obtener usuario
    req.user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] }
    });

    if (!req.user) {
      return res.status(401).json({ 
        message: 'Usuario no encontrado' 
      });
    }

    if (!req.user.is_active) {
      return res.status(403).json({ 
        message: 'Cuenta desactivada' 
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({ 
      message: 'Token inválido' 
    });
  }
};
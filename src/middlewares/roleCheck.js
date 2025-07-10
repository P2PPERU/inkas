// src/middlewares/roleCheck.js
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Rol ${req.user.role} no autorizado para esta acción`
      });
    }
    next();
  };
};

// Middleware específicos por rol
exports.isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      message: 'Acceso restringido solo para administradores'
    });
  }
  next();
};

exports.isAgent = (req, res, next) => {
  if (!['admin', 'agent'].includes(req.user.role)) {
    return res.status(403).json({
      message: 'Acceso restringido para agentes'
    });
  }
  next();
};

exports.isEditor = (req, res, next) => {
  if (!['admin', 'editor'].includes(req.user.role)) {
    return res.status(403).json({
      message: 'Acceso restringido para editores'
    });
  }
  next();
};
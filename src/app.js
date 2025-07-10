const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');
const errorMiddleware = require('./middlewares/error.middleware');

const app = express();

// Seguridad
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // límite de solicitudes
});
app.use('/api/', limiter);

// Logging
app.use(morgan('combined'));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api', routes);

// Archivos estáticos
app.use('/uploads', express.static('uploads'));

// Manejo de errores
app.use(errorMiddleware);

module.exports = app;
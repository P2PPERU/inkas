require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models'); // Cambiará cuando creemos los modelos

const PORT = process.env.PORT || 3000;

// Función para conectar a la base de datos
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL conectado exitosamente');
    
    // Sincronizar modelos en desarrollo (no usar en producción)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('✅ Modelos sincronizados');
    }
  } catch (error) {
    console.error('❌ Error al conectar con PostgreSQL:', error);
    process.exit(1);
  }
};

// Iniciar servidor
const startServer = async () => {
  await connectDB();
  
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📱 Ambiente: ${process.env.NODE_ENV}`);
  });
};

startServer();

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Error no manejado:', err);
  // Cerrar servidor y conexión a BD
  sequelize.close(() => {
    process.exit(1);
  });
});
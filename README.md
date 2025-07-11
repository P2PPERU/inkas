🎰 inkas Club Backend
Sistema backend completo para gestión de clubs de poker con múltiples niveles de usuario y funcionalidades de gamificación.
📋 Tabla de Contenidos

Características
Arquitectura
Instalación
Configuración
Uso
API Endpoints
Testing
Despliegue
Contribuir

✨ Características
👥 Sistema de Roles

Admin: Control total del sistema
Agentes: Gestionan sus propios clientes y códigos
Editores: Publican noticias y contenido
Clientes: Jugadores finales

🔑 Funcionalidades Principales
1. Sistema de Afiliados

Agentes pueden registrar clientes
Códigos de afiliación con bonificaciones
Tracking de comisiones
Dashboard de estadísticas

2. Rankings de Jugadores

Rankings por: puntos, manos jugadas, torneos, rake
Soporte para jugadores externos (no registrados)
Importación masiva desde Excel
Posiciones calculadas automáticamente
Histórico de cambios

3. Ruleta de Premios

Giro demo para nuevos usuarios
Giro real tras validación
Códigos canjeables por giros
Premios configurables con probabilidades
Comportamientos: instant_cash, bonus, manual, custom

4. Sistema de Bonificaciones

Tipos: welcome, deposit, referral, achievement, custom, roulette_spin
Asignación por agentes/admin
Aplicación automática al balance
Control de expiración

5. Gestión de Noticias

Categorías: general, torneos, promociones, actualizaciones
Sistema de publicación con imágenes
Tags y destacados
Control de visibilidad

🏗️ Arquitectura
poker-club-backend/
├── src/
│   ├── app.js              # Configuración Express
│   ├── server.js           # Servidor principal
│   ├── config/             # Configuraciones
│   │   ├── database.js
│   │   ├── multer.js
│   │   └── swagger.js
│   ├── controllers/        # Controladores
│   ├── middlewares/        # Middlewares
│   ├── models/            # Modelos Sequelize
│   ├── routes/            # Rutas API
│   ├── services/          # Servicios
│   └── utils/             # Utilidades
├── migrations/            # Migraciones DB
├── tests/                # Tests
├── uploads/              # Archivos subidos
└── templates/            # Plantillas
🚀 Instalación
Requisitos Previos

Node.js >= 14
PostgreSQL >= 12
npm o yarn

Pasos

Clonar el repositorio

bashgit clone https://github.com/tu-usuario/poker-club-backend.git
cd poker-club-backend

Instalar dependencias

bashnpm install

Configurar variables de entorno

bashcp .env.example .env
# Editar .env con tus configuraciones

Crear base de datos

bashnpm run db:create
npm run db:migrate
npm run db:seed  # Opcional: datos de prueba

Iniciar servidor

bash# Desarrollo
npm run dev

# Producción
npm start
⚙️ Configuración
Variables de Entorno (.env)
env# Server
NODE_ENV=development
PORT=3000

# Database
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=poker_club
DB_HOST=localhost
DB_PORT=5432
DB_DIALECT=postgres

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRE=7d
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRE=30d

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Client
CLIENT_URL=http://localhost:3001

# Defaults
DEFAULT_WELCOME_BONUS=50
DEFAULT_COMMISSION_RATE=10
📡 API Endpoints
Documentación Completa
La documentación completa está disponible en Swagger:
http://localhost:3000/api-docs
Endpoints Principales
🔐 Autenticación

POST /api/auth/register - Registro de usuario
POST /api/auth/login - Iniciar sesión
GET /api/auth/profile - Obtener perfil
POST /api/auth/refresh - Renovar token

👤 Usuarios

GET /api/users/profile - Mi perfil
PUT /api/users/profile - Actualizar perfil
PUT /api/users/password - Cambiar contraseña

🏆 Rankings

GET /api/rankings - Rankings públicos
GET /api/rankings/player/:playerId - Ranking de jugador
PUT /api/rankings/player/:playerId - Crear/actualizar ranking (Admin)
POST /api/rankings/import - Importar desde Excel (Admin)

🎰 Ruleta

GET /api/roulette/my-status - Estado de giros
POST /api/roulette/spin - Ejecutar giro
POST /api/roulette/validate-code - Validar código
GET /api/roulette/prizes - Ver premios (Admin)

🎁 Bonificaciones

GET /api/bonus/my-bonuses - Mis bonificaciones
POST /api/bonus/claim/:bonusId - Reclamar bonus
POST /api/bonus - Crear bonus (Agent/Admin)

📰 Noticias

GET /api/news - Listar noticias
GET /api/news/:id - Ver noticia
POST /api/news - Crear noticia (Editor/Admin)

🧪 Testing
Ejecutar Tests
bash# Todos los tests
npm test

# Con coverage
npm run test:coverage

# En modo watch
npm run test:watch

# Solo unit tests
npm run test:unit

# Solo integration tests
npm run test:integration
Estructura de Tests
javascript// Ejemplo de test
describe('Auth Endpoints', () => {
  it('debe registrar un nuevo usuario', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });
});
🔒 Seguridad
Implementaciones

JWT para autenticación
Bcrypt para hash de contraseñas
Helmet para headers de seguridad
Rate limiting para prevenir abuse
Validación de inputs con express-validator
CORS configurado
SQL injection protection con Sequelize

Mejores Prácticas

Nunca commitear .env
Usar HTTPS en producción
Rotar JWT secrets regularmente
Logs de auditoría para acciones críticas
Backup regular de base de datos

📦 Despliegue
Heroku
bash# Crear app
heroku create poker-club-api

# Agregar PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# Configurar variables
heroku config:set JWT_SECRET=your-secret

# Deploy
git push heroku main

# Migraciones
heroku run npm run db:migrate
Docker
dockerfileFROM node:14-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
🤝 Contribuir

Fork el proyecto
Crear feature branch (git checkout -b feature/AmazingFeature)
Commit cambios (git commit -m 'Add AmazingFeature')
Push al branch (git push origin feature/AmazingFeature)
Abrir Pull Request

Estándares de Código

ESLint configurado
Prettier para formateo
Commits siguiendo Conventional Commits
Tests requeridos para nuevas features
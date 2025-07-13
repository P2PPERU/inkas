const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Inkas Poker Club API',
    version: '1.0.0',
    description: 'API completa para sistema de gestión de club de poker',
    contact: {
      name: 'Soporte Técnico',
      email: 'soporte@inkaspoker.com'
    }
  },
  servers: [
    {
      url: 'http://localhost:3000/api',
      description: 'Servidor de desarrollo'
    },
    {
      url: 'https://api.inkaspoker.com/api',
      description: 'Servidor de producción'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Ingrese el token JWT'
      }
    },
    schemas: {
      // User Schemas
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { 
            type: 'string',
            enum: ['admin', 'agent', 'editor', 'client']
          },
          balance: { type: 'number', format: 'decimal' },
          profile_data: {
            type: 'object',
            properties: {
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              phone: { type: 'string' },
              avatar: { type: 'string', nullable: true }
            }
          },
          is_active: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' }
        }
      },
      
      // Auth Schemas
      LoginRequest: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { 
            type: 'string',
            description: 'Email o username'
          },
          password: { type: 'string', minLength: 6 }
        }
      },
      
      RegisterRequest: {
        type: 'object',
        required: ['username', 'email', 'password'],
        properties: {
          username: { 
            type: 'string', 
            minLength: 3,
            pattern: '^[a-z0-9_]+$'
          },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          phone: { type: 'string' },
          affiliateId: { type: 'string', format: 'uuid' },
          affiliateCode: { type: 'string' }
        }
      },
      
      AuthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          token: { type: 'string' },
          refreshToken: { type: 'string' },
          user: { $ref: '#/components/schemas/User' }
        }
      },
      
      // Ranking Schemas
      Ranking: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          player_id: { type: 'string', format: 'uuid', nullable: true },
          external_player_name: { type: 'string', nullable: true },
          is_external: { type: 'boolean' },
          ranking_type: {
            type: 'string',
            enum: ['points', 'hands_played', 'tournaments', 'rake']
          },
          points: { type: 'integer' },
          hands_played: { type: 'integer' },
          tournaments_played: { type: 'integer' },
          total_rake: { type: 'number', format: 'decimal' },
          position: { type: 'integer' },
          season: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
          ranking_period: {
            type: 'string',
            enum: ['all_time', 'monthly', 'weekly', 'daily']
          }
        }
      },
      
      // Roulette Schemas
      RoulettePrize: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          prize_type: { type: 'string' },
          prize_behavior: {
            type: 'string',
            enum: ['instant_cash', 'bonus', 'manual', 'custom']
          },
          prize_value: { type: 'number' },
          probability: { type: 'number', minimum: 0, maximum: 100 },
          color: { type: 'string', pattern: '^#[0-9A-F]{6}$' },
          position: { type: 'integer', minimum: 1, maximum: 20 }
        }
      },
      
      SpinResult: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          spin: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              type: {
                type: 'string',
                enum: ['demo', 'welcome_real', 'code', 'bonus']
              },
              is_real: { type: 'boolean' },
              prize: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string' },
                  value: { type: 'number' },
                  color: { type: 'string' },
                  position: { type: 'integer' }
                }
              }
            }
          },
          message: { type: 'string' }
        }
      },
      
      // Bonus Schemas
      Bonus: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string' },
          type: {
            type: 'string',
            enum: ['welcome', 'deposit', 'referral', 'achievement', 'custom', 'roulette_spin']
          },
          amount: { type: 'number' },
          status: {
            type: 'string',
            enum: ['pending', 'active', 'claimed', 'expired']
          },
          valid_until: { type: 'string', format: 'date-time', nullable: true }
        }
      },
      
      // News Schemas
      News: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          content: { type: 'string' },
          summary: { type: 'string' },
          image_url: { type: 'string', nullable: true },
          category: {
            type: 'string',
            enum: ['general', 'tournament', 'promotion', 'update']
          },
          status: {
            type: 'string',
            enum: ['draft', 'published', 'archived']
          },
          views: { type: 'integer' },
          tags: {
            type: 'array',
            items: { type: 'string' }
          },
          featured: { type: 'boolean' },
          published_at: { type: 'string', format: 'date-time' }
        }
      },
      
      // Common Schemas
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: { type: 'object' }
        }
      },
      
      PaginatedResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'array',
            items: { type: 'object' }
          },
          totalPages: { type: 'integer' },
          currentPage: { type: 'integer' },
          total: { type: 'integer' }
        }
      },
      
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', default: false },
          message: { type: 'string' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                message: { type: 'string' }
              }
            }
          }
        }
      }
    }
  },
  tags: [
    { name: 'Auth', description: 'Endpoints de autenticación' },
    { name: 'Users', description: 'Gestión de usuarios' },
    { name: 'Rankings', description: 'Rankings de jugadores' },
    { name: 'Roulette', description: 'Sistema de ruleta' },
    { name: 'Bonus', description: 'Sistema de bonificaciones' },
    { name: 'News', description: 'Gestión de noticias' },
    { name: 'Agent', description: 'Funciones de agente' },
    { name: 'Affiliate', description: 'Sistema de afiliados' },
    { name: 'Admin', description: 'Funciones administrativas' }
  ]
};

const options = {
  swaggerDefinition,
  apis: ['./src/routes/*.js'], // Path to API routes
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = {
  swaggerUi,
  swaggerSpec
};
// src/services/email.service.js
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs').promises;

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Verificar conexión
    this.transporter.verify((error, success) => {
      if (error) {
        console.error('Error en configuración de email:', error);
      } else {
        console.log('Servidor de email listo para enviar mensajes');
      }
    });
  }

  // Plantilla base de email
  async getEmailTemplate(content) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Poker Club</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background: #fff;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
          .header {
            background: #2c3e50;
            color: #fff;
            padding: 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .content {
            padding: 30px;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background: #3498db;
            color: #fff;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            background: #34495e;
            color: #ecf0f1;
            text-align: center;
            padding: 20px;
            font-size: 14px;
          }
          .footer a {
            color: #3498db;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎰 Poker Club</h1>
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <p>© 2024 Poker Club. Todos los derechos reservados.</p>
            <p>Si tienes preguntas, contáctanos en <a href="mailto:soporte@pokerclub.com">soporte@pokerclub.com</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Enviar email de bienvenida
  async sendWelcomeEmail(user) {
    try {
      const content = `
        <h2>¡Bienvenido a Poker Club, ${user.profile.firstName || user.username}!</h2>
        <p>Estamos emocionados de tenerte con nosotros. Tu cuenta ha sido creada exitosamente.</p>
        <p><strong>Detalles de tu cuenta:</strong></p>
        <ul>
          <li>Usuario: ${user.username}</li>
          <li>Email: ${user.email}</li>
          <li>Rol: ${this.getRoleName(user.role)}</li>
        </ul>
        <p>Para comenzar, inicia sesión con tus credenciales:</p>
        <a href="${process.env.CLIENT_URL}/login" class="button">Iniciar Sesión</a>
        <p>¡Que tengas mucha suerte en las mesas!</p>
      `;

      const html = await this.getEmailTemplate(content);

      const mailOptions = {
        from: `"Poker Club" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: '¡Bienvenido a Poker Club! 🎰',
        html
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Email de bienvenida enviado a ${user.email}`);
    } catch (error) {
      console.error('Error al enviar email de bienvenida:', error);
      throw error;
    }
  }

  // Enviar notificación de bonificación
  async sendBonusNotification(user, bonus) {
    try {
      const content = `
        <h2>¡${user.profile.firstName || user.username}, tienes una nueva bonificación!</h2>
        <p>Se te ha asignado una nueva bonificación en tu cuenta.</p>
        <div style="background: #ecf0f1; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #27ae60; margin-top: 0;">${bonus.name}</h3>
          <p><strong>Tipo:</strong> ${this.getBonusTypeName(bonus.type)}</p>
          <p><strong>Monto:</strong> $${bonus.amount}</p>
          ${bonus.description ? `<p><strong>Descripción:</strong> ${bonus.description}</p>` : ''}
          ${bonus.validUntil ? `<p><strong>Válido hasta:</strong> ${new Date(bonus.validUntil).toLocaleDateString()}</p>` : ''}
        </div>
        <p>Para reclamar tu bonificación, inicia sesión en tu cuenta:</p>
        <a href="${process.env.CLIENT_URL}/bonuses" class="button">Ver Mis Bonificaciones</a>
        <p>¡No dejes pasar esta oportunidad!</p>
      `;

      const html = await this.getEmailTemplate(content);

      const mailOptions = {
        from: `"Poker Club" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: `🎁 Nueva Bonificación: ${bonus.name}`,
        html
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Email de bonificación enviado a ${user.email}`);
    } catch (error) {
      console.error('Error al enviar email de bonificación:', error);
      throw error;
    }
  }

  // Enviar código de ruleta
  async sendRouletteCode(user, code, prize) {
    try {
      const content = `
        <h2>¡${user.profile.firstName || user.username}, aquí está tu código de ruleta!</h2>
        <p>Has recibido un código especial para usar en nuestra ruleta de premios.</p>
        <div style="background: #3498db; color: white; padding: 30px; border-radius: 10px; text-align: center; margin: 20px 0;">
          <h1 style="margin: 0; font-size: 36px; letter-spacing: 5px;">${code}</h1>
        </div>
        <p><strong>Premio:</strong> ${this.getPrizeDescription(prize)}</p>
        <p>Para usar tu código:</p>
        <ol>
          <li>Inicia sesión en tu cuenta</li>
          <li>Ve a la sección de Ruleta</li>
          <li>Ingresa el código mostrado arriba</li>
          <li>¡Gira y gana!</li>
        </ol>
        <a href="${process.env.CLIENT_URL}/roulette" class="button">Ir a la Ruleta</a>
        <p><small>Este código es único y solo puede ser usado una vez.</small></p>
      `;

      const html = await this.getEmailTemplate(content);

      const mailOptions = {
        from: `"Poker Club" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: '🎯 Tu Código de Ruleta Exclusivo',
        html
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Email de código de ruleta enviado a ${user.email}`);
    } catch (error) {
      console.error('Error al enviar email de código:', error);
      throw error;
    }
  }

  // Enviar resumen de actividad (para agentes)
  async sendAgentActivityReport(agent, stats) {
    try {
      const content = `
        <h2>Resumen de Actividad - ${new Date().toLocaleDateString()}</h2>
        <p>Hola ${agent.profile.firstName || agent.username}, aquí está tu resumen de actividad:</p>
        
        <h3>📊 Estadísticas de Clientes</h3>
        <ul>
          <li>Total de clientes: ${stats.clients.total}</li>
          <li>Clientes activos: ${stats.clients.active}</li>
          <li>Nuevos esta semana: ${stats.clients.newThisWeek || 0}</li>
        </ul>

        <h3>🎁 Bonificaciones</h3>
        <ul>
          <li>Bonificaciones creadas: ${stats.bonuses.created || 0}</li>
          <li>Bonificaciones reclamadas: ${stats.bonuses.claimed || 0}</li>
          <li>Monto total distribuido: $${stats.bonuses.totalAmount || 0}</li>
        </ul>

        <h3>🎯 Códigos de Ruleta</h3>
        <ul>
          <li>Códigos generados: ${stats.rouletteCodes.total || 0}</li>
          <li>Códigos usados: ${stats.rouletteCodes.used || 0}</li>
          <li>Tasa de uso: ${stats.rouletteCodes.useRate || 0}%</li>
        </ul>

        <p>Para ver más detalles, accede a tu dashboard:</p>
        <a href="${process.env.CLIENT_URL}/agent/dashboard" class="button">Ver Dashboard Completo</a>
      `;

      const html = await this.getEmailTemplate(content);

      const mailOptions = {
        from: `"Poker Club" <${process.env.EMAIL_USER}>`,
        to: agent.email,
        subject: '📈 Tu Resumen de Actividad Semanal',
        html
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Email de resumen enviado a ${agent.email}`);
    } catch (error) {
      console.error('Error al enviar resumen de actividad:', error);
      throw error;
    }
  }

  // Enviar notificación de contraseña cambiada
  async sendPasswordChangedEmail(user) {
    try {
      const content = `
        <h2>Contraseña Actualizada</h2>
        <p>Hola ${user.profile.firstName || user.username},</p>
        <p>Tu contraseña ha sido actualizada exitosamente.</p>
        <p><strong>Fecha y hora:</strong> ${new Date().toLocaleString()}</p>
        <p>Si no realizaste este cambio, por favor contacta inmediatamente a nuestro equipo de soporte.</p>
        <a href="mailto:soporte@pokerclub.com" class="button">Contactar Soporte</a>
        <p>Por tu seguridad, te recomendamos:</p>
        <ul>
          <li>No compartir tu contraseña con nadie</li>
          <li>Usar una contraseña única para tu cuenta</li>
          <li>Cambiar tu contraseña regularmente</li>
        </ul>
      `;

      const html = await this.getEmailTemplate(content);

      const mailOptions = {
        from: `"Poker Club Security" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: '🔒 Contraseña Actualizada',
        html
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Email de cambio de contraseña enviado a ${user.email}`);
    } catch (error) {
      console.error('Error al enviar email de cambio de contraseña:', error);
      throw error;
    }
  }

  // Enviar notificación de torneo
  async sendTournamentNotification(users, tournament) {
    try {
      const content = `
        <h2>🏆 ¡Nuevo Torneo Disponible!</h2>
        <h3>${tournament.name}</h3>
        <p>${tournament.description}</p>
        
        <div style="background: #ecf0f1; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>📅 Fecha:</strong> ${new Date(tournament.date).toLocaleDateString()}</p>
          <p><strong>⏰ Hora:</strong> ${tournament.time}</p>
          <p><strong>💰 Premio Total:</strong> $${tournament.prizePool}</p>
          <p><strong>👥 Jugadores máximos:</strong> ${tournament.maxPlayers}</p>
          <p><strong>🎫 Buy-in:</strong> $${tournament.buyIn}</p>
        </div>

        <p>¡No te pierdas esta oportunidad de demostrar tus habilidades!</p>
        <a href="${process.env.CLIENT_URL}/tournaments/${tournament.id}" class="button">Registrarse Ahora</a>
        
        <p><small>Los cupos son limitados. ¡Regístrate pronto!</small></p>
      `;

      const html = await this.getEmailTemplate(content);

      // Enviar emails en lotes para evitar sobrecarga
      const batchSize = 50;
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        const promises = batch.map(user => {
          const mailOptions = {
            from: `"Poker Club Tournaments" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: `🏆 Nuevo Torneo: ${tournament.name}`,
            html
          };
          return this.transporter.sendMail(mailOptions);
        });

        await Promise.all(promises);
        console.log(`Batch ${i / batchSize + 1} enviado (${batch.length} emails)`);
      }
    } catch (error) {
      console.error('Error al enviar notificaciones de torneo:', error);
      throw error;
    }
  }

  // Helpers
  getRoleName(role) {
    const roles = {
      admin: 'Administrador',
      agent: 'Agente',
      editor: 'Editor',
      client: 'Cliente'
    };
    return roles[role] || role;
  }

  getBonusTypeName(type) {
    const types = {
      welcome: 'Bono de Bienvenida',
      deposit: 'Bono de Depósito',
      referral: 'Bono por Referido',
      achievement: 'Bono de Logro',
      custom: 'Bono Especial'
    };
    return types[type] || type;
  }

  getPrizeDescription(prize) {
    switch (prize.type) {
      case 'bonus':
        return `Bonificación de $${prize.value}`;
      case 'points':
        return `${prize.value} puntos para el ranking`;
      case 'free_spin':
        return `${prize.value} giro(s) gratis`;
      case 'discount':
        return `${prize.value}% de descuento`;
      default:
        return prize.description || 'Premio especial';
    }
  }
}

module.exports = new EmailService();
// src/utils/constants.js
module.exports = {
  USER_ROLES: {
    ADMIN: 'admin',
    AGENT: 'agent',
    EDITOR: 'editor',
    CLIENT: 'client'
  },
  
  NEWS_CATEGORIES: {
    GENERAL: 'general',
    TOURNAMENT: 'tournament',
    PROMOTION: 'promotion',
    UPDATE: 'update'
  },
  
  NEWS_STATUS: {
    DRAFT: 'draft',
    PUBLISHED: 'published',
    ARCHIVED: 'archived'
  },
  
  BONUS_TYPES: {
    WELCOME: 'welcome',
    DEPOSIT: 'deposit',
    REFERRAL: 'referral',
    ACHIEVEMENT: 'achievement',
    CUSTOM: 'custom'
  },
  
  BONUS_STATUS: {
    PENDING: 'pending',
    ACTIVE: 'active',
    CLAIMED: 'claimed',
    EXPIRED: 'expired'
  },
  
  ROULETTE_PRIZES: {
    BONUS: 'bonus',
    POINTS: 'points',
    FREE_SPIN: 'free_spin',
    DISCOUNT: 'discount'
  },
  
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER: 500
  }
};
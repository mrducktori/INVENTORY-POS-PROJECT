import rateLimit from 'express-rate-limit';

// General API rate limiter - 100 requests per 15 minutes
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

// Auth rate limiter - stricter limits for login attempts
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// User management rate limiter - moderate limits for user creation/updates
export const userManagementLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many user management requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Loose limiter for general operations - 200 requests per 15 minutes
export const looseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Create/Write operations limiter - moderate limits
export const createLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many creation requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

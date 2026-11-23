import rateLimit from 'express-rate-limit';

// General API rate limiter - 5000 requests per 15 minutes
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skip: (req) => {
    // Never throttle local development traffic
    const ip = req.ip || req.connection?.remoteAddress || '';
    if (ip === '127.0.0.1' || ip === '::1' || ip.includes('127.0.0.1') || process.env.NODE_ENV === 'development') {
      return true;
    }
    // Never throttle public visual menu browsing or CMS content reads
    const url = req.originalUrl || req.url || '';
    return req.method === 'GET' && (url.includes('/pos/products') || url.includes('/cms'));
  }
});

const isLocalOrDev = (req) => {
  const ip = req.ip || req.connection?.remoteAddress || '';
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.includes('127.0.0.1') ||
    process.env.NODE_ENV === 'development'
  );
};

// Auth rate limiter - stricter limits for login attempts
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Too many failed login attempts. Please try again in 15 minutes.', locked: true },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: isLocalOrDev
});

// User management rate limiter - moderate limits for user creation/updates
export const userManagementLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many user management requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: isLocalOrDev
});

// Loose limiter for general operations - 200 requests per 15 minutes
export const looseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: isLocalOrDev
});

// Create/Write operations limiter - moderate limits
export const createLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many creation requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: isLocalOrDev
});

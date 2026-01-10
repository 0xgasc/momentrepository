// Logger utility with configurable log levels
// Set LOG_LEVEL env var to: ERROR, WARN, INFO, or DEBUG

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Default to WARN in production, DEBUG in development
const getLogLevel = () => {
  if (process.env.LOG_LEVEL) {
    return LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] ?? LOG_LEVELS.WARN;
  }
  return process.env.NODE_ENV === 'production' ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG;
};

const currentLevel = getLogLevel();

const logger = {
  // Always log errors
  error: (...args) => console.error('[ERROR]', new Date().toISOString(), ...args),

  // Log warnings in WARN level and above
  warn: (...args) => {
    if (currentLevel >= LOG_LEVELS.WARN) {
      console.warn('[WARN]', new Date().toISOString(), ...args);
    }
  },

  // Log info in INFO level and above
  info: (...args) => {
    if (currentLevel >= LOG_LEVELS.INFO) {
      console.log('[INFO]', new Date().toISOString(), ...args);
    }
  },

  // Log debug only in DEBUG level
  debug: (...args) => {
    if (currentLevel >= LOG_LEVELS.DEBUG) {
      console.log('[DEBUG]', new Date().toISOString(), ...args);
    }
  },

  // Always log security-related events
  security: (...args) => console.log('[SECURITY]', new Date().toISOString(), ...args)
};

module.exports = logger;

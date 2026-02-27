import pino from 'pino';

export interface LogContext {
  requestId?: string;
  userId?: string;
  workspaceId?: string;
  recordingId?: string;
  jobId?: string;
  [key: string]: any;
}

// Create logger instance
// In production, output JSON. In development, use pretty printing
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  }),
  ...(isProduction && {
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  }),
});

/**
 * Create a child logger with context
 */
export function createLogger(context: LogContext = {}) {
  return logger.child(context);
}

/**
 * Default logger instance
 */
export default logger;

/**
 * Helper functions for common log operations
 */
export const log = {
  info: (message: string, context?: LogContext) => {
    logger.info(context || {}, message);
  },
  error: (message: string, error?: Error | unknown, context?: LogContext) => {
    const logContext = {
      ...context,
      ...(error instanceof Error
        ? {
            error: {
              message: error.message,
              stack: error.stack,
              name: error.name,
            },
          }
        : { error }),
    };
    logger.error(logContext, message);
  },
  warn: (message: string, context?: LogContext) => {
    logger.warn(context || {}, message);
  },
  debug: (message: string, context?: LogContext) => {
    logger.debug(context || {}, message);
  },
};

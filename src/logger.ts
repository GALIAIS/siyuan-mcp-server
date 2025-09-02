/**
 * 简单的日志记录器
 */

export interface LogLevel {
  DEBUG: number;
  INFO: number;
  WARN: number;
  ERROR: number;
}

export const LOG_LEVELS: LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

class Logger {
  private currentLevel: number = LOG_LEVELS.INFO;

  setLevel(level: number): void {
    this.currentLevel = level;
  }

  debug(message: any, ...args: any[]): void {
    if (this.currentLevel <= LOG_LEVELS.DEBUG) {
      console.debug('[DEBUG]', message, ...args);
    }
  }

  info(message: any, ...args: any[]): void {
    if (this.currentLevel <= LOG_LEVELS.INFO) {
      console.info('[INFO]', message, ...args);
    }
  }

  warn(message: any, ...args: any[]): void {
    if (this.currentLevel <= LOG_LEVELS.WARN) {
      console.warn('[WARN]', message, ...args);
    }
  }

  error(message: any, ...args: any[]): void {
    if (this.currentLevel <= LOG_LEVELS.ERROR) {
      console.error('[ERROR]', message, ...args);
    }
  }
}

const logger = new Logger();
export default logger;
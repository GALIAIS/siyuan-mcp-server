/**
 * 统一日志系统
 * 使用pino作为底层日志库，提供高性能日志记录
 * 
 * @author CodeBuddy
 * @since 1.0.0
 */

import pino from 'pino';

export interface Logger {
  error(message: string | object, ...args: any[]): void;
  warn(message: string | object, ...args: any[]): void;
  info(message: string | object, ...args: any[]): void;
  debug(message: string | object, ...args: any[]): void;
  child(bindings: object): Logger;
}

/**
 * Pino日志记录器包装类
 */
class PinoLoggerWrapper implements Logger {
  private pinoLogger: pino.Logger;

  constructor() {
    this.pinoLogger = pino({
      level: process.env.LOG_LEVEL || 'error', // 在 MCP 模式下只输出错误日志
      transport: process.env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: {
          destination: 2, // 输出到 stderr 而不是 stdout
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      } : undefined
    });
  }

  error(message: string | object, ...args: any[]): void {
    if (typeof message === 'object') {
      this.pinoLogger.error(message, ...args);
    } else {
      this.pinoLogger.error(message, ...args);
    }
  }

  warn(message: string | object, ...args: any[]): void {
    if (typeof message === 'object') {
      this.pinoLogger.warn(message, ...args);
    } else {
      this.pinoLogger.warn(message, ...args);
    }
  }

  info(message: string | object, ...args: any[]): void {
    if (typeof message === 'object') {
      this.pinoLogger.info(message, ...args);
    } else {
      this.pinoLogger.info(message, ...args);
    }
  }

  debug(message: string | object, ...args: any[]): void {
    if (typeof message === 'object') {
      this.pinoLogger.debug(message, ...args);
    } else {
      this.pinoLogger.debug(message, ...args);
    }
  }

  child(bindings: object): Logger {
    const childLogger = this.pinoLogger.child(bindings);
    return new PinoLoggerWrapper();
  }
}

/**
 * 创建模块专用日志器
 * @param module - 模块名称
 * @returns 模块日志器实例
 */
export const createModuleLogger = (module: string): Logger => {
  const logger = new PinoLoggerWrapper();
  return logger.child({ module });
};

// 导出默认日志记录器实例
const logger = new PinoLoggerWrapper();
export default logger;
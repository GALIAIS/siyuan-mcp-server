/**
 * 完全静默的日志记录器
 * 用户不需要任何日志输出
 */

interface LogLevel {
  DEBUG: number;
  INFO: number;
  WARN: number;
  ERROR: number;
}

const LOG_LEVELS: LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

class Logger {
  private currentLevel: number = LOG_LEVELS.ERROR + 1; // 设置为最高级别，禁用所有日志

  setLevel(level: number): void {
    // 忽略设置，保持静默
  }

  debug(message: any, ...args: any[]): void {
    // 完全静默 - 用户不需要任何日志
  }

  info(message: any, ...args: any[]): void {
    // 完全静默 - 用户不需要任何日志
  }

  warn(message: any, ...args: any[]): void {
    // 完全静默 - 用户不需要任何日志
  }

  error(message: any, ...args: any[]): void {
    // 完全静默 - 用户不需要任何日志
  }

  silentInfo(message: any, ...args: any[]): void {
    // 完全静默 - 用户不需要任何日志
  }

  private formatMessage(message: any, ...args: any[]): string {
    // 保留方法以避免编译错误，但不使用
    return '';
  }
}

const logger = new Logger();
export default logger;

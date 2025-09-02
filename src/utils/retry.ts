import logger from '../logger';

export interface RetryConfig {
  maxRetries: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  baseDelay: number; // 基础延迟时间（毫秒）
  maxDelay: number; // 最大延迟时间（毫秒）
  retryableErrors: string[]; // 可重试的错误类型
  onRetry?: (attempt: number, error: Error) => void;
}

export interface RetryStats {
  totalAttempts: number;
  successfulRetries: number;
  failedRetries: number;
  averageAttempts: number;
}

export class RetryManager {
  private stats: RetryStats = {
    totalAttempts: 0,
    successfulRetries: 0,
    failedRetries: 0,
    averageAttempts: 0
  };

  private defaultConfig: RetryConfig = {
    maxRetries: 3,
    backoffStrategy: 'exponential',
    baseDelay: 1000,
    maxDelay: 10000,
    retryableErrors: [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'Network Error',
      'timeout'
    ]
  };

  /**
   * 执行带重试的操作
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    config?: Partial<RetryConfig>
  ): Promise<T> {
    const finalConfig = { ...this.defaultConfig, ...config };
    let lastError: Error;
    let attempt = 0;

    while (attempt <= finalConfig.maxRetries) {
      try {
        this.stats.totalAttempts++;
        const result = await operation();
        
        if (attempt > 0) {
          this.stats.successfulRetries++;
          logger.info(`操作在第${attempt + 1}次尝试后成功`);
        }
        
        this.updateAverageAttempts();
        return result;
        
      } catch (error) {
        lastError = error as Error;
        
        // 检查是否是可重试的错误
        if (!this.isRetryableError(lastError, finalConfig.retryableErrors)) {
          logger.debug(`不可重试的错误: ${lastError.message}`);
          throw lastError;
        }

        // 如果已达到最大重试次数
        if (attempt >= finalConfig.maxRetries) {
          this.stats.failedRetries++;
          logger.error(`操作失败，已达到最大重试次数 ${finalConfig.maxRetries}`);
          break;
        }

        // 计算延迟时间
        const delay = this.calculateDelay(attempt, finalConfig);
        
        logger.warn({
          attempt: attempt + 1,
          maxRetries: finalConfig.maxRetries,
          delay,
          error: lastError.message
        }, `操作失败，将在${delay}ms后重试`);

        // 调用重试回调
        if (finalConfig.onRetry) {
          finalConfig.onRetry(attempt + 1, lastError);
        }

        // 等待延迟时间
        await this.delay(delay);
        attempt++;
      }
    }

    this.updateAverageAttempts();
    throw lastError!;
  }

  /**
   * 检查错误是否可重试
   */
  private isRetryableError(error: Error, retryableErrors: string[]): boolean {
    const errorMessage = error.message.toLowerCase();
    const errorCode = (error as any).code;
    
    return retryableErrors.some(retryableError => {
      const lowerRetryable = retryableError.toLowerCase();
      return errorMessage.includes(lowerRetryable) || 
             errorCode === retryableError ||
             error.name.toLowerCase().includes(lowerRetryable);
    });
  }

  /**
   * 计算延迟时间
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay: number;

    switch (config.backoffStrategy) {
      case 'linear':
        delay = config.baseDelay * (attempt + 1);
        break;
      case 'exponential':
        delay = config.baseDelay * Math.pow(2, attempt);
        break;
      case 'fixed':
      default:
        delay = config.baseDelay;
        break;
    }

    // 添加随机抖动，避免雷群效应
    const jitter = Math.random() * 0.1 * delay;
    delay += jitter;

    // 确保不超过最大延迟时间
    return Math.min(delay, config.maxDelay);
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 更新平均尝试次数
   */
  private updateAverageAttempts(): void {
    const totalOperations = this.stats.successfulRetries + this.stats.failedRetries;
    if (totalOperations > 0) {
      this.stats.averageAttempts = this.stats.totalAttempts / totalOperations;
    }
  }

  /**
   * 获取重试统计信息
   */
  getStats(): RetryStats {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalAttempts: 0,
      successfulRetries: 0,
      failedRetries: 0,
      averageAttempts: 0
    };
  }
}

// 全局重试管理器实例
export const retryManager = new RetryManager();

/**
 * 便捷的重试函数
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<T> {
  return retryManager.withRetry(operation, config);
}
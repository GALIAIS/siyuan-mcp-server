/**
 * 批量操作优化器
 * 专门处理大量文档的批量读取、处理和优化
 */

import logger from '../logger';

/**
 * 批量操作配置接口
 */
export interface BatchConfig {
  batchSize: number;          // 批处理大小
  maxConcurrency: number;     // 最大并发数
  delay: number;              // 批次间延迟（毫秒）
  retryAttempts: number;      // 重试次数
  timeoutMs: number;          // 超时时间（毫秒）
  memoryThreshold: number;    // 内存阈值（MB）
}

/**
 * 默认批量操作配置
 */
export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  batchSize: 5,
  maxConcurrency: 3,
  delay: 100,
  retryAttempts: 3,
  timeoutMs: 30000,
  memoryThreshold: 100
};

/**
 * 批量操作结果接口
 */
export interface BatchResult<T> {
  success: T[];
  failed: Array<{ item: any; error: string }>;
  totalProcessed: number;
  executionTime: number;
  memoryUsage: {
    before: number;
    after: number;
    peak: number;
  };
}

/**
 * 内存监控器
 */
class MemoryMonitor {
  private initialMemory: number;
  private peakMemory: number;

  constructor() {
    this.initialMemory = this.getCurrentMemoryUsage();
    this.peakMemory = this.initialMemory;
  }

  /**
   * 获取当前内存使用量（MB）
   */
  getCurrentMemoryUsage(): number {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / 1024 / 1024);
  }

  /**
   * 更新峰值内存
   */
  updatePeak(): void {
    const current = this.getCurrentMemoryUsage();
    if (current > this.peakMemory) {
      this.peakMemory = current;
    }
  }

  /**
   * 获取内存统计
   */
  getStats() {
    return {
      before: this.initialMemory,
      after: this.getCurrentMemoryUsage(),
      peak: this.peakMemory
    };
  }

  /**
   * 检查是否超过内存阈值
   */
  isOverThreshold(threshold: number): boolean {
    return this.getCurrentMemoryUsage() > threshold;
  }

  /**
   * 强制垃圾回收（如果可用）
   */
  forceGC(): void {
    if (global.gc) {
      global.gc();
      logger.info('强制垃圾回收执行');
    }
  }
}

/**
 * 批量操作优化器类
 */
export class BatchOptimizer {
  private config: BatchConfig;
  private memoryMonitor: MemoryMonitor;

  constructor(config: Partial<BatchConfig> = {}) {
    this.config = { ...DEFAULT_BATCH_CONFIG, ...config };
    this.memoryMonitor = new MemoryMonitor();
  }

  /**
   * 执行批量操作
   * @param items 要处理的项目数组
   * @param processor 处理函数
   * @returns 批量操作结果
   */
  async executeBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>
  ): Promise<BatchResult<R>> {
    const startTime = Date.now();
    const results: R[] = [];
    const failures: Array<{ item: T; error: string }> = [];

    logger.info({
      totalItems: items.length,
      batchSize: this.config.batchSize,
      maxConcurrency: this.config.maxConcurrency
    }, '开始批量操作');

    try {
      // 将项目分批处理
      for (let i = 0; i < items.length; i += this.config.batchSize) {
        const batch = items.slice(i, i + this.config.batchSize);
        
        // 检查内存使用情况
        this.memoryMonitor.updatePeak();
        if (this.memoryMonitor.isOverThreshold(this.config.memoryThreshold)) {
          logger.warn({
            currentMemory: this.memoryMonitor.getCurrentMemoryUsage(),
            threshold: this.config.memoryThreshold
          }, '内存使用量超过阈值，执行垃圾回收');
          
          this.memoryMonitor.forceGC();
          
          // 增加额外延迟以允许内存释放
          await this.delay(this.config.delay * 2);
        }

        // 并发处理当前批次
        const batchResults = await this.processBatchConcurrently(batch, processor);
        
        // 分离成功和失败的结果
        batchResults.forEach(result => {
          if (result.success && result.data !== undefined) {
            results.push(result.data);
          } else {
            failures.push({ item: result.item, error: result.error || '处理失败' });
          }
        });

        // 批次间延迟
        if (i + this.config.batchSize < items.length) {
          await this.delay(this.config.delay);
        }

        // 记录进度
        const progress = Math.min(i + this.config.batchSize, items.length);
        logger.info({
          processed: progress,
          total: items.length,
          percentage: Math.round((progress / items.length) * 100)
        }, '批量操作进度');
      }

      const executionTime = Date.now() - startTime;
      const memoryStats = this.memoryMonitor.getStats();

      logger.info({
        totalProcessed: items.length,
        successful: results.length,
        failed: failures.length,
        executionTime,
        memoryStats
      }, '批量操作完成');

      return {
        success: results,
        failed: failures,
        totalProcessed: items.length,
        executionTime,
        memoryUsage: memoryStats
      };

    } catch (error: any) {
      logger.error({ error: error.message }, '批量操作失败');
      throw error;
    }
  }

  /**
   * 并发处理批次
   * @param batch 当前批次的项目
   * @param processor 处理函数
   * @returns 批次处理结果
   */
  private async processBatchConcurrently<T, R>(
    batch: T[],
    processor: (item: T) => Promise<R>
  ): Promise<Array<{ success: boolean; data?: R; item: T; error?: string }>> {
    // 限制并发数
    const semaphore = new Semaphore(this.config.maxConcurrency);
    
    const promises = batch.map(async (item) => {
      await semaphore.acquire();
      
      try {
        const result = await this.processWithRetry(item, processor);
        return { success: true, data: result, item };
      } catch (error: any) {
        return { 
          success: false, 
          item, 
          error: error.message || '处理失败' 
        };
      } finally {
        semaphore.release();
      }
    });

    return await Promise.all(promises);
  }

  /**
   * 带重试的处理函数
   * @param item 要处理的项目
   * @param processor 处理函数
   * @returns 处理结果
   */
  private async processWithRetry<T, R>(
    item: T,
    processor: (item: T) => Promise<R>
  ): Promise<R> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        // 设置超时
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('操作超时')), this.config.timeoutMs);
        });

        const result = await Promise.race([
          processor(item),
          timeoutPromise
        ]);

        return result;
      } catch (error: any) {
        lastError = error;
        
        if (attempt < this.config.retryAttempts) {
          const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          logger.warn({
            attempt,
            maxAttempts: this.config.retryAttempts,
            error: error.message,
            retryDelay
          }, '处理失败，准备重试');
          
          await this.delay(retryDelay);
        }
      }
    }

    throw lastError!;
  }

  /**
   * 延迟函数
   * @param ms 延迟毫秒数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 动态调整批量配置
   * @param memoryUsage 当前内存使用情况
   * @param processingTime 处理时间
   */
  adaptiveOptimization(memoryUsage: number, processingTime: number): void {
    // 根据内存使用情况调整批次大小
    if (memoryUsage > this.config.memoryThreshold * 0.8) {
      this.config.batchSize = Math.max(1, Math.floor(this.config.batchSize * 0.7));
      this.config.delay = Math.min(this.config.delay * 1.5, 1000);
      logger.info({
        newBatchSize: this.config.batchSize,
        newDelay: this.config.delay
      }, '由于内存压力，调整批量配置');
    }

    // 根据处理时间调整并发数
    if (processingTime > 10000) { // 如果处理时间超过10秒
      this.config.maxConcurrency = Math.max(1, this.config.maxConcurrency - 1);
      logger.info({
        newMaxConcurrency: this.config.maxConcurrency
      }, '由于处理时间过长，降低并发数');
    } else if (processingTime < 2000 && memoryUsage < this.config.memoryThreshold * 0.5) {
      this.config.maxConcurrency = Math.min(5, this.config.maxConcurrency + 1);
      this.config.batchSize = Math.min(10, this.config.batchSize + 1);
      logger.info({
        newMaxConcurrency: this.config.maxConcurrency,
        newBatchSize: this.config.batchSize
      }, '性能良好，提升并发数和批次大小');
    }
  }
}

/**
 * 信号量类，用于控制并发数
 */
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift()!;
      resolve();
    } else {
      this.permits++;
    }
  }
}

/**
 * 创建批量优化器实例
 * @param config 配置选项
 * @returns 批量优化器实例
 */
export function createBatchOptimizer(config: Partial<BatchConfig> = {}): BatchOptimizer {
  return new BatchOptimizer(config);
}

/**
 * 快速批量处理函数
 * @param items 要处理的项目数组
 * @param processor 处理函数
 * @param config 配置选项
 * @returns 批量操作结果
 */
export async function quickBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  config: Partial<BatchConfig> = {}
): Promise<BatchResult<R>> {
  const optimizer = createBatchOptimizer(config);
  return await optimizer.executeBatch(items, processor);
}
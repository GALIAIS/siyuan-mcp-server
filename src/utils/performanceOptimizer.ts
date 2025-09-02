/**
 * 性能优化器 - 简化版
 * 专门针对低参数模型环境进行内存管理和性能优化
 */

import logger from '../logger.js';
import { cacheManager } from './cache.js';

/**
 * 性能配置接口
 */
export interface PerformanceConfig {
  memoryThreshold: number;        // 内存阈值（MB）
  gcInterval: number;             // 垃圾回收间隔（毫秒）
  enableAdaptiveOptimization: boolean; // 启用自适应优化
  lowMemoryMode: boolean;         // 低内存模式
  maxConcurrentOperations: number; // 最大并发操作数
}

/**
 * 默认性能配置
 */
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  memoryThreshold: 100,
  gcInterval: 30000,
  enableAdaptiveOptimization: true,
  lowMemoryMode: false,
  maxConcurrentOperations: 5
};

/**
 * 性能优化器类
 */
export class PerformanceOptimizer {
  private config: PerformanceConfig;
  private gcTimer: NodeJS.Timeout | null = null;
  private operationQueue: Array<() => Promise<any>> = [];
  private activeOperations = 0;

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };
    this.startPerformanceMonitoring();
  }

  /**
   * 启动性能监控
   */
  private startPerformanceMonitoring(): void {
    // 定期垃圾回收
    if (this.config.gcInterval > 0) {
      this.gcTimer = setInterval(() => {
        this.performGarbageCollection();
      }, this.config.gcInterval);
    }
  }

  /**
   * 执行垃圾回收
   */
  private performGarbageCollection(): void {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);

    if (heapUsedMB > this.config.memoryThreshold) {
      if (global.gc) {
        global.gc();
        logger.info(`执行垃圾回收，内存使用: ${heapUsedMB}MB`);
      } else {
        logger.warn('垃圾回收不可用，请使用 --expose-gc 启动参数');
      }
    }
  }

  /**
   * 优化操作执行
   */
  async optimizeOperation<T>(operation: () => Promise<T>): Promise<T> {
    // 如果达到最大并发数，等待
    while (this.activeOperations >= this.config.maxConcurrentOperations) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.activeOperations++;
    
    try {
      const result = await operation();
      return result;
    } finally {
      this.activeOperations--;
    }
  }

  /**
   * 获取当前内存使用情况
   */
  getMemoryUsage(): { heapUsed: number; heapTotal: number; external: number; rss: number } {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024)
    };
  }

  /**
   * 检查是否应该启用低内存模式
   */
  shouldUseLowMemoryMode(): boolean {
    const memUsage = this.getMemoryUsage();
    return this.config.lowMemoryMode || memUsage.heapUsed > this.config.memoryThreshold;
  }

  /**
   * 销毁优化器
   */
  destroy(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
  }
}

// 导出全局性能优化器实例
export const performanceOptimizer = new PerformanceOptimizer();

/**
 * 内存优化装饰器
 */
export function memoryOptimized<T extends (...args: any[]) => Promise<any>>(
  target: T,
  options: { cacheKey?: string; ttl?: number } = {}
): T {
  return (async (...args: any[]) => {
    const { cacheKey, ttl = 300000 } = options;
    
    // 如果提供了缓存键，尝试从缓存获取
    if (cacheKey) {
      const cache = cacheManager.getCache('memoryOptimized');
      const key = `${cacheKey}_${JSON.stringify(args)}`;
      const cached = cache.get(key);
      
      if (cached) {
        return cached;
      }
      
      // 执行操作并缓存结果
      const result = await performanceOptimizer.optimizeOperation(() => target(...args));
      cache.set(key, result, ttl);
      return result;
    }
    
    // 直接执行优化操作
    return await performanceOptimizer.optimizeOperation(() => target(...args));
  }) as T;
}
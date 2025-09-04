/**
 * 基础服务类
 * 提供所有服务的通用功能和接口规范
 */

import logger from '../logger.js';
import { cacheManager } from '../utils/cache.js';
import { performanceOptimizer } from '../utils/performanceOptimizer.js';
import { securityValidator, ValidationResult, RequestContext } from './SecurityValidator.js';
import { retryManager } from '../utils/retry.js';
import { 
  BaseConfig, 
  OperationResult, 
  PerformanceMetrics, 
  HealthCheckResult,
  ModuleStatus 
} from '../interfaces/index.js';

interface SecureOperationOptions {
  useCache?: boolean;
  cacheKey?: string;
  cacheTTL?: number;
  timeout?: number;
  skipValidation?: boolean;
  skipPermissionCheck?: boolean;
  context?: RequestContext;
  retryOptions?: {
    maxRetries: number;
    baseDelay: number;
  };
}

interface ServiceSecurityConfig {
  enableInputValidation: boolean;
  enablePermissionCheck: boolean;
  enableRateLimit: boolean;
  enableAuditLog: boolean;
  maxOperationsPerMinute: number;
  sensitiveOperations: string[];
}

/**
 * 基础服务抽象类
 */
export abstract class BaseService {
  protected config: BaseConfig;
  protected serviceName: string;
  protected version: string;
  protected isInitialized: boolean = false;
  protected errorCount: number = 0;
  protected totalRequests: number = 0;
  protected successfulRequests: number = 0;
  protected lastActivity: Date = new Date();

  constructor(serviceName: string, version: string, config: BaseConfig) {
    this.serviceName = serviceName;
    this.version = version;
    this.config = config;
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    try {
      logger.info(`正在初始化服务: ${this.serviceName} v${this.version}`);
      
      await this.onInitialize();
      
      this.isInitialized = true;
      logger.info(`服务初始化完成: ${this.serviceName}`);
    } catch (error: any) {
      logger.error(`服务初始化失败: ${this.serviceName}`, error);
      throw error;
    }
  }

  /**
   * 子类实现的初始化逻辑
   */
  protected abstract onInitialize(): Promise<void>;

  /**
   * 执行操作（带性能监控和错误处理）
   */
  protected async executeOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    options: {
      useCache?: boolean;
      cacheKey?: string;
      cacheTTL?: number;
      timeout?: number;
    } = {}
  ): Promise<OperationResult<T>> {
    const startTime = Date.now();
    const { useCache = false, cacheKey, cacheTTL = 300000, timeout = 30000 } = options;

    this.totalRequests++;
    this.lastActivity = new Date();

    try {
      // 检查缓存
      if (useCache && cacheKey) {
        const cache = cacheManager.getCache(this.serviceName);
        const cachedResult = cache.get(cacheKey);
        if (cachedResult) {
          logger.debug(`缓存命中: ${operationName} - ${cacheKey}`);
          return this.createSuccessResult(cachedResult, startTime, true);
        }
      }

      // 执行操作（带超时控制）
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`操作超时: ${operationName}`)), timeout);
      });

      const result = await Promise.race([
        performanceOptimizer.optimizeOperation(operation),
        timeoutPromise
      ]);

      // 缓存结果
      if (useCache && cacheKey) {
        const cache = cacheManager.getCache(this.serviceName);
        cache.set(cacheKey, result, cacheTTL);
      }

      this.successfulRequests++;
      return this.createSuccessResult(result, startTime);

    } catch (error: any) {
      this.errorCount++;
      logger.error(`操作失败: ${operationName}`, {
        serviceName: this.serviceName,
        error: error.message,
        stack: error.stack
      });

      return this.createErrorResult(error.message, startTime);
    }
  }

  /**
   * 创建成功结果
   */
  private createSuccessResult<T>(
    data: T, 
    startTime: number, 
    fromCache: boolean = false
  ): OperationResult<T> {
    const executionTime = Date.now() - startTime;
    
    return {
      success: true,
      data,
      message: fromCache ? '操作成功（来自缓存）' : '操作成功',
      timestamp: new Date().toISOString(),
      performance: {
        executionTime,
        memoryUsage: {
          before: 0,
          after: 0,
          peak: 0
        },
        apiCalls: fromCache ? 0 : 1,
        cacheHits: fromCache ? 1 : 0
      }
    };
  }

  /**
   * 创建错误结果
   */
  private createErrorResult<T = null>(error: string, startTime: number): OperationResult<T> {
    const executionTime = Date.now() - startTime;
    
    return {
      success: false,
      data: null,
      error,
      message: '操作失败',
      timestamp: new Date().toISOString(),
      performance: {
        executionTime,
        memoryUsage: {
          before: 0,
          after: 0,
          peak: 0
        },
        apiCalls: 1
      }
    } as OperationResult<T>;
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const memoryUsage = performanceOptimizer.getMemoryUsage();
      const isHealthy = this.isInitialized && this.errorCount < 10;
      
      return {
        status: isHealthy ? 'healthy' : 'degraded',
        details: {
          api: this.isInitialized,
          database: true, // 简化实现
          cache: true,
          memory: {
            used: memoryUsage.heapUsed,
            total: memoryUsage.heapTotal,
            percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
          }
        },
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        details: {
          api: false,
          database: false,
          cache: false,
          memory: { used: 0, total: 0, percentage: 0 }
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 获取模块状态
   */
  getModuleStatus(): ModuleStatus {
    const successRate = this.totalRequests > 0 
      ? (this.successfulRequests / this.totalRequests) * 100 
      : 0;

    return {
      name: this.serviceName,
      version: this.version,
      status: this.isInitialized ? 'active' : 'inactive',
      lastActivity: this.lastActivity.toISOString(),
      errorCount: this.errorCount,
      performance: {
        averageResponseTime: 0, // 简化实现
        successRate: Math.round(successRate * 100) / 100,
        totalRequests: this.totalRequests
      }
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.errorCount = 0;
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.lastActivity = new Date();
    logger.info(`服务统计信息已重置: ${this.serviceName}`);
  }

  /**
   * 销毁服务
   */
  async destroy(): Promise<void> {
    try {
      logger.info(`正在销毁服务: ${this.serviceName}`);
      
      await this.onDestroy();
      
      this.isInitialized = false;
      logger.info(`服务销毁完成: ${this.serviceName}`);
    } catch (error: any) {
      logger.error(`服务销毁失败: ${this.serviceName}`, error);
      throw error;
    }
  }

  /**
   * 子类实现的销毁逻辑
   */
  protected abstract onDestroy(): Promise<void>;

  /**
   * 获取配置
   */
  getConfig(): BaseConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<BaseConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info(`服务配置已更新: ${this.serviceName}`);
  }

  /**
   * 检查服务是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

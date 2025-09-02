/**
 * 服务管理器
 * 统一管理所有服务的生命周期和状态
 */

import logger from '../logger.js';
import { BaseService } from './BaseService.js';
import { HealthCheckResult, ModuleStatus } from '../interfaces/index.js';

/**
 * 服务管理器类
 */
export class ServiceManager {
  private services = new Map<string, BaseService>();
  private isInitialized: boolean = false;

  /**
   * 注册服务
   */
  register(service: BaseService): void {
    const serviceName = service.getModuleStatus().name;
    
    if (this.services.has(serviceName)) {
      logger.warn(`服务 '${serviceName}' 已存在，将被覆盖`);
    }

    this.services.set(serviceName, service);
    logger.info(`服务 '${serviceName}' 注册成功`);
  }

  /**
   * 注销服务
   */
  async unregister(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);
    if (service) {
      await service.destroy();
      this.services.delete(serviceName);
      logger.info(`服务 '${serviceName}' 注销成功`);
    } else {
      logger.warn(`服务 '${serviceName}' 不存在，无法注销`);
    }
  }

  /**
   * 获取服务
   */
  getService<T extends BaseService>(serviceName: string): T | undefined {
    return this.services.get(serviceName) as T;
  }

  /**
   * 初始化所有服务
   */
  async initializeAll(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('服务管理器已初始化');
      return;
    }

    logger.info('开始初始化所有服务...');
    
    const initPromises = Array.from(this.services.entries()).map(async ([name, service]) => {
      try {
        await service.initialize();
        logger.info(`服务 '${name}' 初始化成功`);
      } catch (error: any) {
        logger.error(`服务 '${name}' 初始化失败:`, error);
        throw new Error(`服务 '${name}' 初始化失败: ${error.message}`);
      }
    });

    await Promise.all(initPromises);
    
    this.isInitialized = true;
    logger.info('所有服务初始化完成');
  }

  /**
   * 销毁所有服务
   */
  async destroyAll(): Promise<void> {
    logger.info('开始销毁所有服务...');
    
    const destroyPromises = Array.from(this.services.entries()).map(async ([name, service]) => {
      try {
        await service.destroy();
        logger.info(`服务 '${name}' 销毁成功`);
      } catch (error: any) {
        logger.error(`服务 '${name}' 销毁失败:`, error);
      }
    });

    await Promise.all(destroyPromises);
    
    this.services.clear();
    this.isInitialized = false;
    logger.info('所有服务销毁完成');
  }

  /**
   * 获取所有服务的健康状态
   */
  async getHealthStatus(): Promise<Record<string, HealthCheckResult>> {
    const healthResults: Record<string, HealthCheckResult> = {};
    
    const healthPromises = Array.from(this.services.entries()).map(async ([name, service]) => {
      try {
        healthResults[name] = await service.healthCheck();
      } catch (error: any) {
        logger.error(`获取服务 '${name}' 健康状态失败:`, error);
        healthResults[name] = {
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
    });

    await Promise.all(healthPromises);
    return healthResults;
  }

  /**
   * 获取所有服务的模块状态
   */
  getAllModuleStatus(): Record<string, ModuleStatus> {
    const statusResults: Record<string, ModuleStatus> = {};
    
    for (const [name, service] of this.services.entries()) {
      try {
        statusResults[name] = service.getModuleStatus();
      } catch (error: any) {
        logger.error(`获取服务 '${name}' 模块状态失败:`, error);
        statusResults[name] = {
          name,
          version: 'unknown',
          status: 'error',
          lastActivity: new Date().toISOString(),
          errorCount: 999,
          performance: {
            averageResponseTime: 0,
            successRate: 0,
            totalRequests: 0
          }
        };
      }
    }

    return statusResults;
  }

  /**
   * 重启服务
   */
  async restartService(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`服务 '${serviceName}' 不存在`);
    }

    logger.info(`正在重启服务: ${serviceName}`);
    
    try {
      await service.destroy();
      await service.initialize();
      logger.info(`服务 '${serviceName}' 重启成功`);
    } catch (error: any) {
      logger.error(`服务 '${serviceName}' 重启失败:`, error);
      throw error;
    }
  }

  /**
   * 重启所有服务
   */
  async restartAll(): Promise<void> {
    logger.info('开始重启所有服务...');
    
    await this.destroyAll();
    await this.initializeAll();
    
    logger.info('所有服务重启完成');
  }

  /**
   * 获取服务统计信息
   */
  getServiceStats(): {
    totalServices: number;
    activeServices: number;
    inactiveServices: number;
    errorServices: number;
    isManagerInitialized: boolean;
  } {
    const statuses = this.getAllModuleStatus();
    const statusValues = Object.values(statuses);
    
    return {
      totalServices: this.services.size,
      activeServices: statusValues.filter(s => s.status === 'active').length,
      inactiveServices: statusValues.filter(s => s.status === 'inactive').length,
      errorServices: statusValues.filter(s => s.status === 'error').length,
      isManagerInitialized: this.isInitialized
    };
  }

  /**
   * 列出所有服务名称
   */
  listServices(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * 检查服务是否存在
   */
  hasService(serviceName: string): boolean {
    return this.services.has(serviceName);
  }

  /**
   * 检查管理器是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * 重置所有服务的统计信息
   */
  resetAllStats(): void {
    for (const service of this.services.values()) {
      service.resetStats();
    }
    logger.info('所有服务统计信息已重置');
  }
}

// 导出全局服务管理器实例
export const serviceManager = new ServiceManager();
/**
 * 应用程序核心
 * 统一的应用程序入口点和生命周期管理
 */

import logger from '../logger.js';
import { serviceManager } from './ServiceManager.js';
import { toolRegistry } from '../tools/toolRegistry.js';
import { standardizedTools } from '../tools/standardizedTools.js';
import { SiyuanService } from '../services/SiyuanService.js';

/**
 * 应用程序配置接口
 */
export interface ApplicationConfig {
  siyuan: {
    baseURL?: string;
    token: string;
    autoDiscoverPort?: boolean;
  };
  performance: {
    memoryThreshold?: number;
    gcInterval?: number;
    enableAdaptiveOptimization?: boolean;
    lowMemoryMode?: boolean;
  };
  cache: {
    enabled?: boolean;
    defaultTTL?: number;
    maxSize?: number;
    cleanupInterval?: number;
  };
  logging: {
    level?: 'error' | 'warn' | 'info' | 'debug';
    enableFileLogging?: boolean;
  };
}

/**
 * 默认应用程序配置
 */
const DEFAULT_CONFIG: ApplicationConfig = {
  siyuan: {
    baseURL: undefined,
    token: '',
    autoDiscoverPort: true,
  },
  performance: {
    memoryThreshold: 100,
    gcInterval: 30000,
    enableAdaptiveOptimization: true,
    lowMemoryMode: false
  },
  cache: {
    enabled: true,
    defaultTTL: 300000,
    maxSize: 1000,
    cleanupInterval: 60000
  },
  logging: {
    level: 'info',
    enableFileLogging: false
  }
};

/**
 * 应用程序状态枚举
 */
export enum ApplicationState {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error'
}

/**
 * 应用程序类
 */
export class Application {
  private config: ApplicationConfig;
  private state: ApplicationState = ApplicationState.UNINITIALIZED;
  private startTime: Date | null = null;

  constructor(config: Partial<ApplicationConfig> = {}) {
    this.config = this.mergeConfig(DEFAULT_CONFIG, config);
  }

  /**
   * 合并配置
   */
  private mergeConfig(defaultConfig: ApplicationConfig, userConfig: Partial<ApplicationConfig>): ApplicationConfig {
    return {
      siyuan: { ...defaultConfig.siyuan, ...userConfig.siyuan },
      performance: { ...defaultConfig.performance, ...userConfig.performance },
      cache: { ...defaultConfig.cache, ...userConfig.cache },
      logging: { ...defaultConfig.logging, ...userConfig.logging }
    };
  }

  /**
   * 初始化应用程序
   */
  async initialize(): Promise<void> {
    if (this.state !== ApplicationState.UNINITIALIZED) {
      throw new Error(`应用程序已初始化，当前状态: ${this.state}`);
    }

    this.state = ApplicationState.INITIALIZING;
    this.startTime = new Date();

    try {
      logger.info('开始初始化应用程序...');

      // 初始化服务
      await this.initializeServices();

      // 初始化工具
      await this.initializeTools();

      this.state = ApplicationState.RUNNING;
      logger.info('应用程序初始化完成');

    } catch (error: any) {
      this.state = ApplicationState.ERROR;
      logger.error('应用程序初始化失败:', error);
      throw error;
    }
  }

  /**
   * 初始化服务
   */
  private async initializeServices(): Promise<void> {
    logger.info('初始化服务...');

    // 创建并注册思源笔记服务
    const siyuanService = new SiyuanService({
      baseURL: this.config.siyuan.baseURL,
      token: this.config.siyuan.token
    });

    serviceManager.register(siyuanService);

    // 初始化所有服务
    await serviceManager.initializeAll();

    logger.info('服务初始化完成');
  }

  /**
   * 初始化工具
   */
  private async initializeTools(): Promise<void> {
    logger.info('初始化工具...');

    // 注册所有标准化工具
    for (const tool of standardizedTools) {
      toolRegistry.register(tool);
    }

    logger.info(`工具初始化完成，共注册 ${standardizedTools.length} 个工具`);
  }

  /**
   * 获取应用程序状态
   */
  getState(): ApplicationState {
    return this.state;
  }

  /**
   * 获取应用程序运行时间
   */
  getUptime(): number {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime.getTime();
  }

  /**
   * 检查应用程序是否正在运行
   */
  isRunning(): boolean {
    return this.state === ApplicationState.RUNNING;
  }

  /**
   * 检查应用程序是否已准备就绪
   */
  isReady(): boolean {
    return this.state === ApplicationState.RUNNING && serviceManager.isReady();
  }
}

// 导出全局应用程序实例
export const application = new Application();
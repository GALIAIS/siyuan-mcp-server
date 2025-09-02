/**
 * 向后兼容API封装层
 * 保持现有功能的完整性，同时提供新的优化功能
 */

import { serviceManager } from '../core/ServiceManager.js';
import { SiyuanService } from '../services/SiyuanService.js';
import logger from '../logger.js';

/**
 * 传统API接口（保持向后兼容）
 */
export interface LegacySiyuanClient {
  // 基础方法
  request(endpoint: string, data?: any): Promise<any>;
  checkHealth(): Promise<{ status: string; detail: any }>;
  searchNotes(query: string, limit?: number): Promise<any>;
  
  // 新增的递归搜索和批量操作方法（向后兼容）
  recursiveSearchNotes(
    query: string, 
    notebook?: string, 
    options?: {
      maxDepth?: number;
      includeContent?: boolean;
      fuzzyMatch?: boolean;
      limit?: number;
    }
  ): Promise<any>;
  
  batchReadAllDocuments(
    notebookId: string, 
    options?: {
      maxDepth?: number;
      includeContent?: boolean;
      batchSize?: number;
      delay?: number;
    }
  ): Promise<any[]>;
  
  // 兼容性方法（保持向后兼容）
  getBlock(id: string): Promise<any>;
  createBlock(content: string, parentID?: string): Promise<any>;
  updateBlock(id: string, content: string): Promise<any>;
  deleteBlock(id: string): Promise<any>;
}

/**
 * 传统API封装器类
 */
export class LegacyAPIWrapper implements LegacySiyuanClient {
  private siyuanService: SiyuanService | null = null;

  constructor() {
    // 延迟获取服务实例，因为可能还未初始化
  }

  private getSiyuanService(): SiyuanService {
    if (!this.siyuanService) {
      const service = serviceManager.getService<SiyuanService>('SiyuanService');
      if (!service) {
        throw new Error('SiyuanService 未初始化');
      }
      this.siyuanService = service;
    }
    return this.siyuanService;
  }

  /**
   * 通用API请求（向后兼容）
   */
  async request(endpoint: string, data?: any): Promise<any> {
    try {
      const service = this.getSiyuanService();
      const result = await service.request(endpoint, data);
      return result; // 直接返回API响应，保持向后兼容
    } catch (error: any) {
      logger.error(`Legacy API请求失败: ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * 健康检查（向后兼容）
   */
  async checkHealth(): Promise<{ status: string; detail: any }> {
    try {
      const service = this.getSiyuanService();
      const health = await service.healthCheck();
      return {
        status: health.status,
        detail: health.details
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        detail: { error: error.message }
      };
    }
  }

  /**
   * 搜索笔记（向后兼容）
   */
  async searchNotes(query: string, limit: number = 10): Promise<any> {
    try {
      const service = this.getSiyuanService();
      const result = await service.searchContent(query, {
        // query字段已包含在参数中,
        types: {
          document: true,
          heading: true,
          list: true,
          listItem: true,
          codeBlock: true,
          mathBlock: true,
          table: true,
          blockquote: true,
          superBlock: true,
          paragraph: true
        },
        method: 0,
        orderBy: 0,
        groupBy: 0,
        page: 1,
        pageSize: limit
      });

      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || '搜索失败');
      }
    } catch (error: any) {
      logger.error('Legacy搜索失败:', error);
      throw error;
    }
  }

  /**
   * 递归搜索笔记（向后兼容）
   */
  async recursiveSearchNotes(
    query: string, 
    notebook?: string, 
    options: {
      maxDepth?: number;
      includeContent?: boolean;
      fuzzyMatch?: boolean;
      limit?: number;
    } = {}
  ): Promise<any> {
    try {
      const service = this.getSiyuanService();
      const result = await service.recursiveSearch(query, notebook, {
        ...options,
        // query字段已包含在参数中
      });
      
      if (result.success) {
        // 转换为传统格式
        return {
          code: 0,
          data: result.data,
          msg: result.message
        };
      } else {
        return {
          code: -1,
          data: null,
          msg: result.error || '递归搜索失败'
        };
      }
    } catch (error: any) {
      logger.error('Legacy递归搜索失败:', error);
      return {
        code: -1,
        data: null,
        msg: error.message
      };
    }
  }

  /**
   * 批量读取所有文档（向后兼容）
   */
  async batchReadAllDocuments(
    notebookId: string, 
    options: {
      maxDepth?: number;
      includeContent?: boolean;
      batchSize?: number;
      delay?: number;
    } = {}
  ): Promise<any[]> {
    try {
      const service = this.getSiyuanService();
      
      // 首先获取文档树
      const treeResult = await service.getDocumentTree(notebookId);
      if (!treeResult.success) {
        throw new Error(treeResult.error || '获取文档树失败');
      }

      // 收集所有文档ID
      const collectDocumentIds = (nodes: any[], depth: number = 0): string[] => {
        if (depth >= (options.maxDepth || 10)) return [];
        
        const ids: string[] = [];
        for (const node of nodes || []) {
          if (node.type === 'NodeDocument') {
            ids.push(node.id);
          }
          if (node.children && node.children.length > 0) {
            ids.push(...collectDocumentIds(node.children, depth + 1));
          }
        }
        return ids;
      };

      const documentIds = collectDocumentIds(treeResult.data || []);

      if (!options.includeContent) {
        return documentIds.map(id => ({ id, notebookId }));
      }

      // 批量读取文档内容
      const batchResult = await service.batchReadDocuments(documentIds, {
        batchSize: options.batchSize || 5,
        delay: options.delay || 100,
        maxConcurrency: 3
      });

      if (batchResult.success) {
        return batchResult.data || [];
      } else {
        throw new Error(batchResult.error || '批量读取失败');
      }
    } catch (error: any) {
      logger.error('Legacy批量读取失败:', error);
      throw error;
    }
  }

  /**
   * 获取块（向后兼容）
   */
  async getBlock(id: string): Promise<any> {
    return await this.request('/api/block/getBlockKramdown', { id });
  }

  /**
   * 创建块（向后兼容）
   */
  async createBlock(content: string, parentID?: string): Promise<any> {
    return await this.request('/api/block/insertBlock', {
      data: content,
      dataType: 'markdown',
      parentID
    });
  }

  /**
   * 更新块（向后兼容）
   */
  async updateBlock(id: string, content: string): Promise<any> {
    return await this.request('/api/block/updateBlock', {
      id,
      data: content,
      dataType: 'markdown'
    });
  }

  /**
   * 删除块（向后兼容）
   */
  async deleteBlock(id: string): Promise<any> {
    return await this.request('/api/block/deleteBlock', { id });
  }
}

/**
 * 创建传统API客户端（向后兼容）
 */
export function createSiyuanClient(config: any): LegacySiyuanClient {
  logger.info('创建传统API客户端（兼容模式）');
  return new LegacyAPIWrapper();
}

// 导出传统接口类型（向后兼容）
export type SiyuanClient = LegacySiyuanClient;

// 导出配置接口
export interface SiyuanClientConfig {
  baseURL?: string;
  token: string;
  autoDiscoverPort?: boolean;
}
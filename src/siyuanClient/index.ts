/**
 * 思源客户端入口文件
 * 提供向后兼容的API接口
 */

import logger from '../logger';
import { createBlockOperations, BlockOperations } from './blocks';
import { createDocumentOperations, DocumentOperations } from './documents';
import { createAssetOperations, AssetOperations } from './assets';
import { SqlService } from '../services/sql-service';
import { FileService } from '../services/file-service';
import { createPortDiscovery } from '../utils/portDiscovery';
import { BatchOperations } from '../tools/batchOperations';
import { withRetry } from '../utils/retry';
import axios, { AxiosInstance } from 'axios';

export interface SiyuanClientConfig {
  baseURL?: string;
  token: string;
  autoDiscoverPort?: boolean;
}

export interface SiyuanClient {
  // 基础方法
  request(endpoint: string, data?: any): Promise<any>;
  checkHealth(): Promise<{ status: string; detail: any }>;
  searchNotes(query: string, limit?: number): Promise<any>;
  
  // SQL查询方法
  executeSql(params: { stmt: string }): Promise<any>;
  
  // 块操作方法
  insertBlock(params: { data: string; dataType: string; parentID?: string; previousID?: string }): Promise<any>;
  getBlockByID(params: { id: string }): Promise<any>;
  
  // 新增的递归搜索和批量操作方法
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
  
  // 操作模块
  blocks: BlockOperations;
  documents: DocumentOperations;
  assets: AssetOperations;
  sqlService: SqlService;
  file: FileService;
  batch: BatchOperations;
  system: {
    getSystemInfo(): Promise<any>;
  };
  
  // 兼容性方法（保持向后兼容）
  getBlock(id: string): Promise<any>;
  createBlock(content: string, parentID?: string): Promise<any>;
  updateBlock(id: string, content: string): Promise<any>;
  deleteBlock(id: string): Promise<any>;
}

export function createSiyuanClient(config: SiyuanClientConfig): SiyuanClient {
  let { baseURL, token, autoDiscoverPort = true } = config;
  
  // 创建HTTP客户端（先使用默认配置）
  const httpClient = axios.create({
    baseURL: baseURL || undefined,
    timeout: 30000,
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json'
    }
  });

  // 自动发现端口（优化版）
  if (autoDiscoverPort && (!baseURL || baseURL === '' || undefined)) {
    const portDiscovery = createPortDiscovery(config.token);
    
    // 异步发现端口并更新 httpClient 的 baseURL
    portDiscovery.autoDiscover().then(result => {
      if (result) {
        baseURL = result.baseURL;
        httpClient.defaults.baseURL = result.baseURL;
        logger.info(`端口发现成功，使用端口: ${result.port}，URL: ${result.baseURL}`);
      } else {
        logger.warn('端口发现失败，请确保思源笔记正在运行。将尝试使用默认端口 6806');
      }
    }).catch(error => {
      logger.error('端口发现过程中出错:', error);
      logger.warn('将尝试使用默认端口 6806 连接');
    });
  } else if (baseURL) {
    logger.info(`使用自定义思源笔记 URL: ${baseURL}`);
  }

  // 通用请求方法
  const request = async (endpoint: string, data?: any): Promise<any> => {
    try {
      logger.info(`发送请求到: ${endpoint}`, { data });
      const response = await withRetry(async () => {
        return await httpClient.post(endpoint, data);
      }, { maxRetries: 3 });
      
      logger.info(`请求响应: ${endpoint}`, { status: response.status, data: response.data });
      return response.data;
    } catch (error: any) {
      logger.error(`API请求失败: ${endpoint}`, { error: error.message, data });
      throw error;
    }
  };

  // 创建操作模块
  const blocks = createBlockOperations({ request } as any);
  const documents = createDocumentOperations({ request } as any);
  const assets = createAssetOperations({ request } as any);
  
  // 创建SQL和文件服务
  const sqlService = new SqlService({ request } as any);
  const fileService = new FileService({ request } as any);
  
  // 先创建client对象的基本结构
  const clientBase: Partial<SiyuanClient> = {
    request,
    blocks,
    documents,
    assets,
    sqlService: sqlService,
    file: fileService,
    // 其他方法会在后面添加
  };
  
  // 然后创建batch实例，传入完整的client引用
  const batch = new BatchOperations(clientBase as SiyuanClient);

  const client: SiyuanClient = {
    request,
    
    async checkHealth() {
      try {
        const response = await request('/api/system/version');
        return {
          status: response.code === 0 ? 'healthy' : 'unhealthy',
          detail: response
        };
      } catch (error: any) {
        return {
          status: 'unhealthy',
          detail: { error: error.message }
        };
      }
    },

    async searchNotes(query: string, limit = 10) {
      try {
        if (!query || query.trim() === '') {
          throw new Error('搜索查询不能为空');
        }

        const searchData = {
          query: query.trim(),
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
          method: 0, // 0: 关键字搜索
          orderBy: 7, // 7: 相关度降序
          groupBy: 0, // 0: 不分组
          page: 1,
          pageSize: Math.min(Math.max(limit, 1), 100) // 限制在1-100之间
        };

        logger.info('执行搜索', { query, limit, searchData });
        
        // 使用正确的 SiYuan API 端点
        const response = await request('/api/search/fullTextSearchBlock', searchData);
        
        if (response.code !== 0) {
          logger.error('搜索API返回错误', { code: response.code, msg: response.msg });
          throw new Error(`搜索失败: ${response.msg || '未知错误'}`);
        }

        const results = response.data?.blocks || [];
        logger.info(`搜索完成，找到 ${results.length} 个结果`);
        
        return {
          code: 0,
          msg: 'success',
          data: {
            blocks: results,
            matchedBlockCount: results.length,
            matchedRootCount: response.data?.matchedRootCount || 0,
            pageCount: Math.ceil((response.data?.matchedBlockCount || results.length) / searchData.pageSize)
          }
        };
      } catch (error: any) {
        logger.error('搜索笔记失败', { query, limit, error: error.message });
        return {
          code: -1,
          msg: error.message || '搜索失败',
          data: {
            blocks: [],
            matchedBlockCount: 0,
            matchedRootCount: 0,
            pageCount: 0
          }
        };
      }
    },

    // SQL查询方法
    executeSql: async (params: { stmt: string }) => {
      return await request('/api/sql/query', params);
    },

    // 块操作方法
    insertBlock: async (params: { data: string; dataType: string; parentID?: string; previousID?: string }) => {
      return await request('/api/block/insertBlock', params);
    },

    getBlockByID: async (params: { id: string }) => {
      return await request('/api/block/getBlockKramdown', params);
    },

    // 递归搜索方法
    async recursiveSearchNotes(
      query: string, 
      notebook?: string, 
      options: {
        maxDepth?: number;
        includeContent?: boolean;
        fuzzyMatch?: boolean;
        limit?: number;
      } = {}
    ) {
      return await documents.recursiveSearchDocs(query, notebook, options);
    },

    // 批量读取方法
    async batchReadAllDocuments(
      notebookId: string, 
      options: {
        maxDepth?: number;
        includeContent?: boolean;
        batchSize?: number;
        delay?: number;
      } = {}
    ) {
      return await documents.batchReadAllDocuments(notebookId, options);
    },

    // 操作模块
    blocks,
    documents,
    assets,
    sqlService: sqlService,
    file: fileService,
    batch,
    system: {
      getSystemInfo: async () => {
        return await request('/api/system/getConf');
      }
    },

    // 兼容性方法
    getBlock: async (id: string) => {
      return await request('/api/block/getBlockKramdown', { id });
    },

    createBlock: async (content: string, parentID?: string) => {
      return await request('/api/block/insertBlock', {
        data: content,
        dataType: 'markdown',
        parentID
      });
    },

    updateBlock: async (id: string, content: string) => {
      return await request('/api/block/updateBlock', {
        id,
        data: content,
        dataType: 'markdown'
      });
    },

    deleteBlock: async (id: string) => {
      return await request('/api/block/deleteBlock', { id });
    }
  };

  return client;
}

/**
 * 标准化的思源笔记工具集
 * 重构现有工具以符合标准化规范
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { createSiyuanClient } from '../siyuanClient/index.js';
import { 
  StandardTool, 
  ToolConfig, 
  ValidationRule, 
  StandardToolError, 
  ToolErrorType 
} from './standardTypes.js';
import logger from '../logger.js';

// 创建客户端实例
const siyuanClient = createSiyuanClient({
  baseURL: process.env.SIYUAN_API_URL || undefined,
  token: process.env.SIYUAN_TOKEN || '',
  autoDiscoverPort: true
});

/**
 * 列出笔记本工具
 */
export class ListNotebooksTool extends StandardTool {
  constructor() {
    const config: ToolConfig = {
      name: 'siyuan-local/list_notebooks',
      description: '列出所有思源笔记本，返回笔记本的基本信息包括ID、名称、图标等',
      version: '1.0.0',
      category: 'notebook',
      tags: ['notebook', 'list', 'basic'],
      timeout: 10000,
      retryAttempts: 3,
      cacheEnabled: true,
      cacheTTL: 60000, // 1分钟缓存
      rateLimitPerMinute: 60,
      validationRules: [], // 无参数需要验证
      requiredPermissions: ['read:notebooks']
    };
    super(config);
  }

  getToolDefinition(): Tool {
    return {
      name: this.config.name,
      description: this.config.description,
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    };
  }

  async execute(parameters: Record<string, any>): Promise<any> {
    try {
      logger.info('开始获取笔记本列表');
      
      const result = await siyuanClient.request('/api/notebook/lsNotebooks');
      
      if (result && result.code === 0 && result.data) {
        const notebooks = result.data.notebooks || [];
        
        logger.info(`成功获取 ${notebooks.length} 个笔记本`);
        
        return {
          notebooks: notebooks.map((notebook: any) => ({
            id: notebook.id,
            name: notebook.name,
            icon: notebook.icon,
            closed: notebook.closed,
            sort: notebook.sort
          })),
          total: notebooks.length
        };
      } else {
        throw new StandardToolError(
          ToolErrorType.API_ERROR,
          '获取笔记本列表失败',
          'API_RESPONSE_ERROR',
          { apiResponse: result }
        );
      }
    } catch (error: any) {
      if (error instanceof StandardToolError) {
        throw error;
      }
      
      logger.error('获取笔记本列表时发生错误:', error);
      throw new StandardToolError(
        ToolErrorType.NETWORK_ERROR,
        `网络请求失败: ${error.message}`,
        'NETWORK_REQUEST_FAILED',
        { originalError: error.toString() }
      );
    }
  }
}

/**
 * 创建文档工具
 */
export class CreateDocumentTool extends StandardTool {
  constructor() {
    const config: ToolConfig = {
      name: 'siyuan-local/create_document',
      description: '在指定笔记本中创建新文档，支持Markdown格式内容',
      version: '1.0.0',
      category: 'document',
      tags: ['document', 'create', 'markdown'],
      timeout: 15000,
      retryAttempts: 2,
      cacheEnabled: false,
      cacheTTL: 0,
      rateLimitPerMinute: 30,
      validationRules: [
        {
          field: 'notebook',
          required: true,
          type: 'string',
          minLength: 1,
          maxLength: 100,
          pattern: /^[a-zA-Z0-9\-_]+$/
        },
        {
          field: 'title',
          required: true,
          type: 'string',
          minLength: 1,
          maxLength: 200
        },
        {
          field: 'content',
          required: true,
          type: 'string',
          maxLength: 1000000 // 1MB限制
        }
      ],
      requiredPermissions: ['write:documents']
    };
    super(config);
  }

  getToolDefinition(): Tool {
    return {
      name: this.config.name,
      description: this.config.description,
      inputSchema: {
        type: 'object',
        properties: {
          notebook: { 
            type: 'string', 
            description: '笔记本ID，必须是有效的笔记本标识符' 
          },
          title: { 
            type: 'string', 
            description: '文档标题，不能为空' 
          },
          content: { 
            type: 'string', 
            description: '文档内容，支持Markdown格式' 
          }
        },
        required: ['notebook', 'title', 'content']
      }
    };
  }

  async execute(parameters: Record<string, any>): Promise<any> {
    const { notebook, title, content } = parameters;
    
    try {
      logger.info({
        notebook,
        title,
        contentLength: content.length
      }, '开始创建文档');

      const result = await siyuanClient.documents.createDoc(
        notebook,
        `/${title}`,
        title,
        content
      );

      if (result && result.code === 0) {
        const documentId = result.data?.id;
        
        logger.info({
          documentId,
          notebook,
          title
        }, '文档创建成功');

        return {
          id: documentId,
          notebook,
          title,
          path: `/${title}`,
          contentLength: content.length,
          created: new Date().toISOString()
        };
      } else {
        throw new StandardToolError(
          ToolErrorType.API_ERROR,
          `文档创建失败: ${result?.msg || '未知错误'}`,
          'DOCUMENT_CREATION_FAILED',
          { notebook, title, apiResponse: result }
        );
      }
    } catch (error: any) {
      if (error instanceof StandardToolError) {
        throw error;
      }

      logger.error({
        notebook,
        title,
        error: error.message
      }, '创建文档时发生错误');

      throw new StandardToolError(
        ToolErrorType.INTERNAL_ERROR,
        `创建文档时发生错误: ${error.message}`,
        'DOCUMENT_CREATION_ERROR',
        { notebook, title, originalError: error.toString() }
      );
    }
  }
}

/**
 * 递归搜索工具
 */
export class RecursiveSearchTool extends StandardTool {
  constructor() {
    const config: ToolConfig = {
      name: 'siyuan-local/recursive_search',
      description: '递归搜索思源笔记内容，支持多层级文档遍历和深度搜索，提供丰富的搜索选项',
      version: '1.0.0',
      category: 'search',
      tags: ['search', 'recursive', 'advanced'],
      timeout: 30000,
      retryAttempts: 2,
      cacheEnabled: true,
      cacheTTL: 300000, // 5分钟缓存
      rateLimitPerMinute: 20,
      validationRules: [
        {
          field: 'query',
          required: true,
          type: 'string',
          minLength: 1,
          maxLength: 500
        },
        {
          field: 'notebook',
          required: false,
          type: 'string',
          pattern: /^[a-zA-Z0-9\-_]+$/
        },
        {
          field: 'maxDepth',
          required: false,
          type: 'number',
          min: 1,
          max: 20
        },
        {
          field: 'limit',
          required: false,
          type: 'number',
          min: 1,
          max: 200
        }
      ],
      requiredPermissions: ['read:documents', 'search:content']
    };
    super(config);
  }

  getToolDefinition(): Tool {
    return {
      name: this.config.name,
      description: this.config.description,
      inputSchema: {
        type: 'object',
        properties: {
          query: { 
            type: 'string', 
            description: '搜索关键词，支持多个关键词用空格分隔' 
          },
          notebook: { 
            type: 'string', 
            description: '笔记本ID（可选），限制搜索范围' 
          },
          maxDepth: { 
            type: 'number', 
            description: '最大递归深度，默认为10', 
            default: 10 
          },
          includeContent: { 
            type: 'boolean', 
            description: '是否包含文档内容，默认为false', 
            default: false 
          },
          fuzzyMatch: { 
            type: 'boolean', 
            description: '是否启用模糊匹配，默认为true', 
            default: true 
          },
          limit: { 
            type: 'number', 
            description: '返回结果数量限制，默认为50', 
            default: 50 
          }
        },
        required: ['query']
      }
    };
  }

  async execute(parameters: Record<string, any>): Promise<any> {
    const {
      query,
      notebook,
      maxDepth = 10,
      includeContent = false,
      fuzzyMatch = true,
      limit = 50
    } = parameters;

    try {
      logger.info({
        query,
        notebook,
        maxDepth,
        includeContent,
        fuzzyMatch,
        limit
      }, '开始递归搜索');

      const searchResult = await siyuanClient.recursiveSearchNotes(query, notebook, {
        maxDepth,
        includeContent,
        fuzzyMatch,
        limit
      });

      if (searchResult.code === 0) {
        const documentsProcessed = searchResult.data?.totalDocuments || 0;
        
        logger.info({
          query,
          documentsFound: documentsProcessed,
          hasContent: includeContent
        }, '递归搜索完成');

        return {
          query,
          searchResults: searchResult.data,
          searchOptions: {
            notebook: notebook || 'all',
            maxDepth,
            includeContent,
            fuzzyMatch,
            limit
          },
          summary: {
            totalDocuments: documentsProcessed,
            searchTime: Date.now(),
            hasContent: includeContent
          }
        };
      } else {
        throw new StandardToolError(
          ToolErrorType.API_ERROR,
          `递归搜索失败: ${searchResult.msg || '未知错误'}`,
          'RECURSIVE_SEARCH_FAILED',
          { query, notebook, searchOptions: { maxDepth, includeContent, fuzzyMatch, limit } }
        );
      }
    } catch (error: any) {
      if (error instanceof StandardToolError) {
        throw error;
      }

      logger.error({
        query,
        notebook,
        error: error.message
      }, '递归搜索时发生错误');

      throw new StandardToolError(
        ToolErrorType.INTERNAL_ERROR,
        `递归搜索时发生错误: ${error.message}`,
        'RECURSIVE_SEARCH_ERROR',
        { query, notebook, originalError: error.toString() }
      );
    }
  }
}

/**
 * 批量读取文档工具
 */
export class BatchReadDocumentsTool extends StandardTool {
  constructor() {
    const config: ToolConfig = {
      name: 'siyuan-local/batch_read_all',
      description: '批量读取笔记本内所有文档，支持并发处理和性能优化，适合大量文档的批量操作',
      version: '1.0.0',
      category: 'document',
      tags: ['document', 'batch', 'read', 'performance'],
      timeout: 60000, // 1分钟超时
      retryAttempts: 1,
      cacheEnabled: true,
      cacheTTL: 600000, // 10分钟缓存
      rateLimitPerMinute: 10,
      validationRules: [
        {
          field: 'notebookId',
          required: true,
          type: 'string',
          minLength: 1,
          pattern: /^[a-zA-Z0-9\-_]+$/
        },
        {
          field: 'maxDepth',
          required: false,
          type: 'number',
          min: 1,
          max: 15
        },
        {
          field: 'batchSize',
          required: false,
          type: 'number',
          min: 1,
          max: 20
        }
      ],
      requiredPermissions: ['read:documents', 'batch:operations']
    };
    super(config);
  }

  getToolDefinition(): Tool {
    return {
      name: this.config.name,
      description: this.config.description,
      inputSchema: {
        type: 'object',
        properties: {
          notebookId: { 
            type: 'string', 
            description: '笔记本ID，必须是有效的笔记本标识符' 
          },
          maxDepth: { 
            type: 'number', 
            description: '最大递归深度，默认为10', 
            default: 10 
          },
          includeContent: { 
            type: 'boolean', 
            description: '是否包含文档内容，默认为true', 
            default: true 
          },
          batchSize: { 
            type: 'number', 
            description: '批处理大小，默认为5', 
            default: 5 
          },
          delay: { 
            type: 'number', 
            description: '批次间延迟（毫秒），默认为100', 
            default: 100 
          }
        },
        required: ['notebookId']
      }
    };
  }

  async execute(parameters: Record<string, any>): Promise<any> {
    const {
      notebookId,
      maxDepth = 10,
      includeContent = true,
      batchSize = 5,
      delay = 100
    } = parameters;

    try {
      logger.info({
        notebookId,
        maxDepth,
        includeContent,
        batchSize,
        delay
      }, '开始批量读取文档');

      const documents = await siyuanClient.batchReadAllDocuments(notebookId, {
        maxDepth,
        includeContent,
        batchSize,
        delay,
        // maxConcurrency配置已移除，使用默认值,
        // memoryThreshold配置已移除，使用默认值
      });

      const documentsProcessed = documents.length;
      const totalContentLength = documents.reduce((sum, doc) => 
        sum + (doc.contentLength || 0), 0
      );

      logger.info({
        notebookId,
        documentsProcessed,
        totalContentLength,
        averageContentLength: documentsProcessed > 0 ? Math.round(totalContentLength / documentsProcessed) : 0
      }, '批量读取完成');

      return {
        notebookId,
        documents,
        summary: {
          totalDocuments: documentsProcessed,
          totalContentLength,
          averageContentLength: documentsProcessed > 0 ? Math.round(totalContentLength / documentsProcessed) : 0,
          processingOptions: {
            maxDepth,
            includeContent,
            batchSize,
            delay
          }
        }
      };
    } catch (error: any) {
      if (error instanceof StandardToolError) {
        throw error;
      }

      logger.error({
        notebookId,
        error: error.message
      }, '批量读取文档时发生错误');

      throw new StandardToolError(
        ToolErrorType.INTERNAL_ERROR,
        `批量读取文档时发生错误: ${error.message}`,
        'BATCH_READ_ERROR',
        { notebookId, originalError: error.toString() }
      );
    }
  }
}

// 导出所有标准化工具
export const standardizedTools = [
  new ListNotebooksTool(),
  new CreateDocumentTool(),
  new RecursiveSearchTool(),
  new BatchReadDocumentsTool()
];
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
      name: 'list_notebooks',
      description: '列出所有思源笔记本，返回笔记本的基本信息包括ID、名称、图标等。这是获取笔记本列表的基础工具，适用于需要了解可用笔记本的场景。',
      version: '1.0.0',
      category: 'notebook',
      tags: ['notebook', 'list', 'basic'],
      timeout: 10000,
      retryAttempts: 3,
      cacheEnabled: true,
      cacheTTL: 60000, // 1分钟缓存
      rateLimitPerMinute: 60,
      validationRules: [], // 无参数需要验证
      requiredPermissions: ['read:notebooks'],
      aiUsage: {
        whenToUse: '当需要获取所有可用笔记本列表时使用，例如：1) 用户询问有哪些笔记本；2) 需要选择一个笔记本进行后续操作；3) 显示笔记本列表供用户选择；4) 验证笔记本ID是否有效。',
        whenNotToUse: '1) 当已经知道具体的笔记本ID时；2) 当只需要操作特定笔记本时；3) 当需要获取笔记本内的文档列表时（应使用list_documents）。',
        examples: [
          '用户：显示所有笔记本 -> 使用此工具获取笔记本列表',
          '用户：我想在笔记本A中创建文档 -> 先使用此工具获取笔记本列表，找到笔记本A的ID',
          '用户：有哪些笔记本可用？ -> 使用此工具列出所有笔记本'
        ],
        alternativeTools: ['list_documents', 'get_notebook_info'],
        performanceNotes: '此工具支持缓存（60秒TTL），频繁调用不会造成性能问题。返回数据量通常很小，响应速度快。'
      }
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
      name: 'create_document',
      description: '在指定笔记本中创建新文档，支持Markdown格式内容。这是创建文档的核心工具，适用于需要创建新笔记或文章的场景。',
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
      requiredPermissions: ['write:documents'],
      aiUsage: {
        whenToUse: '当需要创建新文档时使用，例如：1) 用户要求创建新的笔记；2) 需要保存AI生成的内容；3) 创建模板文档；4) 批量创建文档。',
        whenNotToUse: '1) 当需要更新现有文档时（应使用update_document）；2) 当需要创建子文档时（应使用create_subdocument）；3) 当只需要创建块而非完整文档时（应使用create_block）。',
        examples: [
          '用户：创建一个关于机器学习的笔记 -> 使用此工具创建新文档',
          '用户：保存这段对话内容 -> 使用此工具创建文档保存对话',
          '用户：创建一个会议记录文档 -> 使用此工具创建会议记录'
        ],
        alternativeTools: ['create_subdocument', 'create_block', 'update_document'],
        performanceNotes: '此工具不支持缓存，每次调用都会创建新文档。内容大小限制为1MB，超大内容应考虑分块创建。'
      }
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
      name: 'recursive_search',
      description: '递归搜索思源笔记内容，支持多层级文档遍历和深度搜索，提供丰富的搜索选项。这是进行深度内容搜索的高级工具，适用于需要全面搜索笔记内容的场景。',
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
      requiredPermissions: ['read:documents', 'search:content'],
      aiUsage: {
        whenToUse: '当需要进行深度搜索时使用，例如：1) 用户要求搜索特定关键词；2) 需要在多个文档中查找内容；3) 需要获取包含特定主题的所有文档；4) 需要遍历文档树进行搜索。',
        whenNotToUse: '1) 当只需要搜索单个文档时（应使用search_in_document）；2) 当只需要获取文档列表时（应使用list_documents）；3) 当需要快速简单搜索时（应使用simple_search）。',
        examples: [
          '用户：搜索所有关于机器学习的笔记 -> 使用此工具递归搜索',
          '用户：查找包含"会议记录"的所有文档 -> 使用此工具进行深度搜索',
          '用户：在笔记本A中搜索"项目计划" -> 使用此工具在指定笔记本中搜索'
        ],
        alternativeTools: ['simple_search', 'search_in_document', 'list_documents'],
        performanceNotes: '此工具支持缓存（5分钟TTL），适合频繁搜索相同内容。递归搜索可能耗时较长，建议设置合理的maxDepth和limit参数以提高性能。'
      }
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
      name: 'batch_read_all',
      description: '批量读取笔记本内所有文档，支持并发处理和性能优化，适合大量文档的批量操作。这是高效读取大量文档的工具，适用于需要获取整个笔记本内容的场景。',
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
      requiredPermissions: ['read:documents', 'batch:operations'],
      aiUsage: {
        whenToUse: '当需要批量读取大量文档时使用，例如：1) 用户要求导出整个笔记本；2) 需要对多个文档进行分析；3) 需要备份笔记本内容；4) 需要获取笔记本的完整内容。',
        whenNotToUse: '1) 当只需要读取单个文档时（应使用get_document）；2) 当只需要获取文档列表时（应使用list_documents）；3) 当文档数量很少时（应使用单个读取工具）。',
        examples: [
          '用户：导出整个笔记本A的内容 -> 使用此工具批量读取所有文档',
          '用户：分析笔记本B中的所有文档 -> 使用此工具获取所有文档内容',
          '用户：备份笔记本C -> 使用此工具批量读取所有文档'
        ],
        alternativeTools: ['get_document', 'list_documents', 'recursive_search'],
        performanceNotes: '此工具支持缓存（10分钟TTL），适合频繁读取相同笔记本。批处理大小和延迟参数可以调整以优化性能。大量文档读取可能耗时较长，建议设置合理的超时时间。'
      }
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

/**
 * 设置块属性工具
 */
export class SetBlockAttrsTool extends StandardTool {
  constructor() {
    const config: ToolConfig = {
      name: 'set_block_attrs',
      description: '设置块的属性，支持自定义属性和系统属性的设置，用于块元数据管理。这是管理块属性的核心工具，适用于需要为块添加或更新元数据的场景。',
      version: '1.0.0',
      category: 'block',
      tags: ['block', 'attribute', 'update'],
      timeout: 10000,
      retryAttempts: 2,
      cacheEnabled: false,
      cacheTTL: 0,
      rateLimitPerMinute: 30,
      validationRules: [
        {
          field: 'id',
          required: true,
          type: 'string',
          minLength: 1
        },
        {
          field: 'attrs',
          required: true,
          type: 'object'
        }
      ],
      requiredPermissions: ['write:blocks'],
      aiUsage: {
        whenToUse: '当需要设置或更新块属性时使用，例如：1) 用户要求为块添加标签；2) 需要设置块的元数据；3) 需要更新块的属性值；4) 需要为块添加自定义属性。',
        whenNotToUse: '1) 当只需要读取块属性时（应使用get_block_attrs）；2) 当需要删除块属性时（应使用delete_block_attrs）；3) 当需要批量设置多个块的属性时（应使用batch_set_block_attrs）。',
        examples: [
          '用户：为这个块添加标签"重要" -> 使用此工具设置tags属性',
          '用户：设置块的优先级为高 -> 使用此工具设置priority属性',
          '用户：为块添加自定义元数据 -> 使用此工具设置自定义属性'
        ],
        alternativeTools: ['get_block_attrs', 'delete_block_attrs', 'batch_set_block_attrs'],
        performanceNotes: '此工具不支持缓存，每次调用都会更新属性。属性值大小建议控制在合理范围内，避免过大的属性值影响性能。'
      }
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
          id: {
            type: 'string',
            description: '块ID，标识需要设置属性的目标块'
          },
          attrs: {
            type: 'object',
            description: '属性对象，包含要设置的键值对'
          }
        },
        required: ['id', 'attrs']
      }
    };
  }

  async execute(parameters: Record<string, any>): Promise<any> {
    const { id, attrs } = parameters;

    try {
      logger.info({ id, attrs }, '开始设置块属性');

      const result = await siyuanClient.request('/api/attr/setBlockAttrs', {
        id,
        attrs
      });

      if (result && result.code === 0) {
        logger.info({ id }, '块属性设置成功');
        return { success: true, id, attrs };
      } else {
        throw new StandardToolError(
          ToolErrorType.API_ERROR,
          `设置块属性失败: ${result?.msg || '未知错误'}`,
          'SET_BLOCK_ATTRS_FAILED',
          { id, apiResponse: result }
        );
      }
    } catch (error: any) {
      if (error instanceof StandardToolError) {
        throw error;
      }

      logger.error({ id, error: error.message }, '设置块属性时发生错误');

      throw new StandardToolError(
        ToolErrorType.INTERNAL_ERROR,
        `设置块属性时发生错误: ${error.message}`,
        'SET_BLOCK_ATTRS_ERROR',
        { id, originalError: error.toString() }
      );
    }
  }
}

/**
 * 获取块属性工具
 */
export class GetBlockAttrsTool extends StandardTool {
  constructor() {
    const config: ToolConfig = {
      name: 'get_block_attrs',
      description: '获取块的属性，包括自定义属性和系统属性，用于块元数据查询。这是查询块属性的核心工具，适用于需要获取块元数据的场景。',
      version: '1.0.0',
      category: 'block',
      tags: ['block', 'attribute', 'read'],
      timeout: 10000,
      retryAttempts: 3,
      cacheEnabled: true,
      cacheTTL: 30000,
      rateLimitPerMinute: 60,
      validationRules: [
        {
          field: 'id',
          required: true,
          type: 'string',
          minLength: 1
        }
      ],
      requiredPermissions: ['read:blocks'],
      aiUsage: {
        whenToUse: '当需要获取块属性时使用，例如：1) 用户要求查看块的标签；2) 需要获取块的元数据；3) 需要检查块的属性值；4) 需要分析块的属性信息。',
        whenNotToUse: '1) 当需要设置块属性时（应使用set_block_attrs）；2) 当需要获取块内容时（应使用get_block）；3) 当需要批量获取多个块的属性时（应使用batch_get_block_attrs）。',
        examples: [
          '用户：查看这个块的标签 -> 使用此工具获取块的属性',
          '用户：获取块的元数据 -> 使用此工具获取所有属性',
          '用户：检查块的优先级 -> 使用此工具获取priority属性'
        ],
        alternativeTools: ['set_block_attrs', 'get_block', 'batch_get_block_attrs'],
        performanceNotes: '此工具支持缓存（30秒TTL），频繁读取相同块的属性不会造成性能问题。返回数据量通常很小，响应速度快。'
      }
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
          id: {
            type: 'string',
            description: '块ID，标识需要获取属性的目标块'
          }
        },
        required: ['id']
      }
    };
  }

  async execute(parameters: Record<string, any>): Promise<any> {
    const { id } = parameters;

    try {
      logger.info({ id }, '开始获取块属性');

      const result = await siyuanClient.request('/api/attr/getBlockAttrs', {
        id
      });

      if (result && result.code === 0) {
        logger.info({ id }, '块属性获取成功');
        return { id, attrs: result.data || {} };
      } else {
        throw new StandardToolError(
          ToolErrorType.API_ERROR,
          `获取块属性失败: ${result?.msg || '未知错误'}`,
          'GET_BLOCK_ATTRS_FAILED',
          { id, apiResponse: result }
        );
      }
    } catch (error: any) {
      if (error instanceof StandardToolError) {
        throw error;
      }

      logger.error({ id, error: error.message }, '获取块属性时发生错误');

      throw new StandardToolError(
        ToolErrorType.INTERNAL_ERROR,
        `获取块属性时发生错误: ${error.message}`,
        'GET_BLOCK_ATTRS_ERROR',
        { id, originalError: error.toString() }
      );
    }
  }
}

/**
 * 渲染模板工具
 */
export class RenderTemplateTool extends StandardTool {
  constructor() {
    const config: ToolConfig = {
      name: 'render_template',
      description: '渲染思源模板，使用指定块作为数据源进行模板渲染。这是模板渲染的核心工具，适用于需要使用模板生成内容的场景。',
      version: '1.0.0',
      category: 'template',
      tags: ['template', 'render'],
      timeout: 15000,
      retryAttempts: 2,
      cacheEnabled: false,
      cacheTTL: 0,
      rateLimitPerMinute: 20,
      validationRules: [
        {
          field: 'id',
          required: true,
          type: 'string',
          minLength: 1
        },
        {
          field: 'content',
          required: true,
          type: 'string'
        }
      ],
      requiredPermissions: ['read:templates'],
      aiUsage: {
        whenToUse: '当需要渲染模板时使用，例如：1) 用户要求使用模板生成内容；2) 需要根据数据源生成文档；3) 需要应用模板格式；4) 需要批量生成格式化内容。',
        whenNotToUse: '1) 当只需要获取模板内容时（应使用get_template）；2) 当需要渲染Sprig模板时（应使用render_sprig_template）；3) 当不需要模板渲染时（应直接使用create_document）。',
        examples: [
          '用户：使用模板生成会议记录 -> 使用此工具渲染模板',
          '用户：根据数据生成报告 -> 使用此工具应用模板',
          '用户：批量生成格式化文档 -> 使用此工具渲染模板'
        ],
        alternativeTools: ['get_template', 'render_sprig_template', 'create_document'],
        performanceNotes: '此工具不支持缓存，每次调用都会渲染模板。模板复杂度和数据量会影响渲染性能，建议优化模板以提高渲染速度。'
      }
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
          id: {
            type: 'string',
            description: '模板ID，用于指定数据源块'
          },
          content: {
            type: 'string',
            description: '模板内容，支持模板语法'
          }
        },
        required: ['id', 'content']
      }
    };
  }

  async execute(parameters: Record<string, any>): Promise<any> {
    const { id, content } = parameters;

    try {
      logger.info({ id, contentLength: content.length }, '开始渲染模板');

      const result = await siyuanClient.request('/api/template/render', {
        id,
        content
      });

      if (result && result.code === 0) {
        logger.info({ id }, '模板渲染成功');
        return {
          content: result.data?.content || '',
          rendered: true
        };
      } else {
        throw new StandardToolError(
          ToolErrorType.API_ERROR,
          `模板渲染失败: ${result?.msg || '未知错误'}`,
          'RENDER_TEMPLATE_FAILED',
          { id, apiResponse: result }
        );
      }
    } catch (error: any) {
      if (error instanceof StandardToolError) {
        throw error;
      }

      logger.error({ id, error: error.message }, '渲染模板时发生错误');

      throw new StandardToolError(
        ToolErrorType.INTERNAL_ERROR,
        `渲染模板时发生错误: ${error.message}`,
        'RENDER_TEMPLATE_ERROR',
        { id, originalError: error.toString() }
      );
    }
  }
}

/**
 * 渲染Sprig模板工具
 */
export class RenderSprigTemplateTool extends StandardTool {
  constructor() {
    const config: ToolConfig = {
      name: 'render_sprig_template',
      description: '渲染Sprig模板，使用指定块作为数据源进行Sprig模板语法渲染。这是Sprig模板渲染的核心工具，适用于需要使用Sprig模板语法的场景。',
      version: '1.0.0',
      category: 'template',
      tags: ['template', 'sprig', 'render'],
      timeout: 15000,
      retryAttempts: 2,
      cacheEnabled: false,
      cacheTTL: 0,
      rateLimitPerMinute: 20,
      validationRules: [
        {
          field: 'id',
          required: true,
          type: 'string',
          minLength: 1
        },
        {
          field: 'sprig',
          required: true,
          type: 'string'
        }
      ],
      requiredPermissions: ['read:templates'],
      aiUsage: {
        whenToUse: '当需要渲染Sprig模板时使用，例如：1) 用户要求使用Sprig模板语法生成内容；2) 需要使用Sprig函数库；3) 需要复杂的模板逻辑；4) 需要使用Sprig特有的模板功能。',
        whenNotToUse: '1) 当只需要渲染普通模板时（应使用render_template）；2) 当不需要Sprig模板语法时（应使用render_template）；3) 当只需要获取模板内容时（应使用get_template）。',
        examples: [
          '用户：使用Sprig模板生成报告 -> 使用此工具渲染Sprig模板',
          '用户：使用Sprig函数处理数据 -> 使用此工具应用Sprig语法',
          '用户：需要复杂的模板逻辑 -> 使用此工具渲染Sprig模板'
        ],
        alternativeTools: ['render_template', 'get_template', 'create_document'],
        performanceNotes: '此工具不支持缓存，每次调用都会渲染模板。Sprig模板语法比普通模板更复杂，渲染性能可能稍低，建议优化模板逻辑。'
      }
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
          id: {
            type: 'string',
            description: '模板ID，用于指定数据源块'
          },
          sprig: {
            type: 'string',
            description: 'Sprig模板内容，支持Sprig模板语法'
          }
        },
        required: ['id', 'sprig']
      }
    };
  }

  async execute(parameters: Record<string, any>): Promise<any> {
    const { id, sprig } = parameters;

    try {
      logger.info({ id, sprigLength: sprig.length }, '开始渲染Sprig模板');

      const result = await siyuanClient.request('/api/template/renderSprig', {
        id,
        sprig
      });

      if (result && result.code === 0) {
        logger.info({ id }, 'Sprig模板渲染成功');
        return {
          content: result.data?.content || '',
          rendered: true
        };
      } else {
        throw new StandardToolError(
          ToolErrorType.API_ERROR,
          `Sprig模板渲染失败: ${result?.msg || '未知错误'}`,
          'RENDER_SPRIG_FAILED',
          { id, apiResponse: result }
        );
      }
    } catch (error: any) {
      if (error instanceof StandardToolError) {
        throw error;
      }

      logger.error({ id, error: error.message }, '渲染Sprig模板时发生错误');

      throw new StandardToolError(
        ToolErrorType.INTERNAL_ERROR,
        `渲染Sprig模板时发生错误: ${error.message}`,
        'RENDER_SPRIG_ERROR',
        { id, originalError: error.toString() }
      );
    }
  }
}

/**
 * 导出Markdown工具
 */
export class ExportMarkdownTool extends StandardTool {
  constructor() {
    const config: ToolConfig = {
      name: 'export_markdown',
      description: '导出文档为Markdown格式，支持单个文档或整个笔记本的导出。这是导出Markdown的核心工具，适用于需要将思源内容转换为Markdown格式的场景。',
      version: '1.0.0',
      category: 'export',
      tags: ['export', 'markdown'],
      timeout: 60000,
      retryAttempts: 1,
      cacheEnabled: false,
      cacheTTL: 0,
      rateLimitPerMinute: 10,
      validationRules: [
        {
          field: 'id',
          required: true,
          type: 'string',
          minLength: 1
        }
      ],
      requiredPermissions: ['read:documents', 'export:data'],
      aiUsage: {
        whenToUse: '当需要导出Markdown格式时使用，例如：1) 用户要求导出文档为Markdown；2) 需要将思源内容转换为Markdown；3) 需要备份文档为Markdown格式；4) 需要在其他工具中使用Markdown内容。',
        whenNotToUse: '1) 当只需要获取文档内容时（应使用get_document）；2) 当需要导出其他格式时（应使用export_pdf等）；3) 当不需要导出时（应使用read相关工具）。',
        examples: [
          '用户：导出这个文档为Markdown -> 使用此工具导出',
          '用户：将笔记转换为Markdown格式 -> 使用此工具导出',
          '用户：备份文档为Markdown -> 使用此工具导出'
        ],
        alternativeTools: ['get_document', 'export_pdf', 'list_documents'],
        performanceNotes: '此工具不支持缓存，每次调用都会执行导出操作。导出大量内容可能耗时较长，建议设置合理的超时时间。导出文件大小受系统限制，超大文档可能需要分批导出。'
      }
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
          id: {
            type: 'string',
            description: '文档或笔记本ID'
          }
        },
        required: ['id']
      }
    };
  }

  async execute(parameters: Record<string, any>): Promise<any> {
    const { id } = parameters;

    try {
      logger.info({ id }, '开始导出Markdown');

      const result = await siyuanClient.request('/api/export/exportMarkdown', {
        id
      });

      if (result && result.code === 0) {
        logger.info({ id }, 'Markdown导出成功');
        return {
          file: result.data?.file || '',
          exported: true
        };
      } else {
        throw new StandardToolError(
          ToolErrorType.API_ERROR,
          `Markdown导出失败: ${result?.msg || '未知错误'}`,
          'EXPORT_MARKDOWN_FAILED',
          { id, apiResponse: result }
        );
      }
    } catch (error: any) {
      if (error instanceof StandardToolError) {
        throw error;
      }

      logger.error({ id, error: error.message }, '导出Markdown时发生错误');

      throw new StandardToolError(
        ToolErrorType.INTERNAL_ERROR,
        `导出Markdown时发生错误: ${error.message}`,
        'EXPORT_MARKDOWN_ERROR',
        { id, originalError: error.toString() }
      );
    }
  }
}

/**
 * 导出文件工具
 */
export class ExportFileTool extends StandardTool {
  constructor() {
    const config: ToolConfig = {
      name: 'export_file',
      description: '导出文档为指定格式文件，支持多种导出格式。这是导出文件的核心工具，适用于需要将思源内容转换为其他格式的场景。',
      version: '1.0.0',
      category: 'export',
      tags: ['export', 'file'],
      timeout: 60000,
      retryAttempts: 1,
      cacheEnabled: false,
      cacheTTL: 0,
      rateLimitPerMinute: 10,
      validationRules: [
        {
          field: 'id',
          required: true,
          type: 'string',
          minLength: 1
        },
        {
          field: 'type',
          required: false,
          type: 'string'
        }
      ],
      requiredPermissions: ['read:documents', 'export:data'],
      aiUsage: {
        whenToUse: '当需要导出文件时使用，例如：1) 用户要求导出文档为指定格式；2) 需要将思源内容转换为其他格式；3) 需要备份文档为文件；4) 需要在其他应用中使用导出的文件。',
        whenNotToUse: '1) 当只需要导出Markdown时（应使用export_markdown）；2) 当只需要获取文档内容时（应使用get_document）；3) 当不需要导出时（应使用read相关工具）。',
        examples: [
          '用户：导出文档为PDF -> 使用此工具指定type为pdf',
          '用户：导出文档为Word -> 使用此工具指定type为docx',
          '用户：导出文档为HTML -> 使用此工具指定type为html'
        ],
        alternativeTools: ['export_markdown', 'get_document', 'list_documents'],
        performanceNotes: '此工具不支持缓存，每次调用都会执行导出操作。导出大量内容可能耗时较长，建议设置合理的超时时间。不同格式的导出性能不同，复杂格式（如PDF）可能需要更长时间。'
      }
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
          id: {
            type: 'string',
            description: '文档ID'
          },
          type: {
            type: 'string',
            description: '导出格式，默认为markdown',
            default: 'markdown'
          }
        },
        required: ['id']
      }
    };
  }

  async execute(parameters: Record<string, any>): Promise<any> {
    const { id, type = 'markdown' } = parameters;

    try {
      logger.info({ id, type }, '开始导出文件');

      const result = await siyuanClient.request('/api/export/exportFile', {
        id,
        type
      });

      if (result && result.code === 0) {
        logger.info({ id, type }, '文件导出成功');
        return {
          file: result.data?.file || '',
          type,
          exported: true
        };
      } else {
        throw new StandardToolError(
          ToolErrorType.API_ERROR,
          `文件导出失败: ${result?.msg || '未知错误'}`,
          'EXPORT_FILE_FAILED',
          { id, type, apiResponse: result }
        );
      }
    } catch (error: any) {
      if (error instanceof StandardToolError) {
        throw error;
      }

      logger.error({ id, type, error: error.message }, '导出文件时发生错误');

      throw new StandardToolError(
        ToolErrorType.INTERNAL_ERROR,
        `导出文件时发生错误: ${error.message}`,
        'EXPORT_FILE_ERROR',
        { id, type, originalError: error.toString() }
      );
    }
  }
}

/**
 * 导出为树状结构工具
 */
export class ExportExpandTool extends StandardTool {
  constructor() {
    const config: ToolConfig = {
      name: 'export_expand',
      description: '导出文档为树状结构JSON格式，保留文档的层级关系。这是导出树状结构的核心工具，适用于需要分析文档层级结构的场景。',
      version: '1.0.0',
      category: 'export',
      tags: ['export', 'tree', 'json'],
      timeout: 30000,
      retryAttempts: 2,
      cacheEnabled: false,
      cacheTTL: 0,
      rateLimitPerMinute: 15,
      validationRules: [
        {
          field: 'id',
          required: true,
          type: 'string',
          minLength: 1
        }
      ],
      requiredPermissions: ['read:documents', 'export:data'],
      aiUsage: {
        whenToUse: '当需要导出树状结构时使用，例如：1) 用户要求分析文档层级结构；2) 需要获取文档的树状JSON；3) 需要处理文档的层级关系；4) 需要可视化文档结构。',
        whenNotToUse: '1) 当只需要获取文档内容时（应使用get_document）；2) 当只需要导出Markdown时（应使用export_markdown）；3) 当不需要树状结构时（应使用其他导出工具）。',
        examples: [
          '用户：导出文档的树状结构 -> 使用此工具导出',
          '用户：分析文档的层级关系 -> 使用此工具获取树状JSON',
          '用户：可视化文档结构 -> 使用此工具导出树状结构'
        ],
        alternativeTools: ['get_document', 'export_markdown', 'list_documents'],
        performanceNotes: '此工具不支持缓存，每次调用都会执行导出操作。树状结构导出需要遍历整个文档树，深层嵌套的文档可能耗时较长。返回的JSON大小取决于文档复杂度，建议控制文档层级深度。'
      }
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
          id: {
            type: 'string',
            description: '文档ID'
          }
        },
        required: ['id']
      }
    };
  }

  async execute(parameters: Record<string, any>): Promise<any> {
    const { id } = parameters;

    try {
      logger.info({ id }, '开始导出树状结构');

      const result = await siyuanClient.request('/api/export/exportExpand', {
        id
      });

      if (result && result.code === 0) {
        logger.info({ id }, '树状结构导出成功');
        return {
          tree: result.data?.tree || {},
          exported: true
        };
      } else {
        throw new StandardToolError(
          ToolErrorType.API_ERROR,
          `树状结构导出失败: ${result?.msg || '未知错误'}`,
          'EXPORT_EXPAND_FAILED',
          { id, apiResponse: result }
        );
      }
    } catch (error: any) {
      if (error instanceof StandardToolError) {
        throw error;
      }

      logger.error({ id, error: error.message }, '导出树状结构时发生错误');

      throw new StandardToolError(
        ToolErrorType.INTERNAL_ERROR,
        `导出树状结构时发生错误: ${error.message}`,
        'EXPORT_EXPAND_ERROR',
        { id, originalError: error.toString() }
      );
    }
  }
}

/**
 * 获取当前时间工具
 */
export class GetCurrentTimeTool extends StandardTool {
  constructor() {
    const config: ToolConfig = {
      name: 'get_current_time',
      description: '获取当前真实时间，支持多种时间格式。这是获取系统时间的核心工具，适用于需要获取当前时间戳或格式化时间的场景。',
      version: '1.0.0',
      category: 'system',
      tags: ['system', 'time', 'datetime'],
      timeout: 1000,
      retryAttempts: 1,
      cacheEnabled: false,
      cacheTTL: 0,
      rateLimitPerMinute: 100,
      validationRules: [
        {
          field: 'format',
          required: false,
          type: 'string',
          enum: ['iso', 'unix', 'local', 'date', 'time', 'datetime']
        },
        {
          field: 'timezone',
          required: false,
          type: 'string'
        }
      ],
      requiredPermissions: [],
      aiUsage: {
        whenToUse: '当需要获取当前时间时使用，例如：1) 用户询问现在几点；2) 需要记录操作时间；3) 需要时间戳；4) 需要格式化的时间字符串；5) 需要特定时区的时间。',
        whenNotToUse: '1) 当需要计算时间差时（应使用时间计算工具）；2) 当需要解析时间字符串时（应使用时间解析工具）；3) 当需要转换时间格式时（应使用时间格式化工具）。',
        examples: [
          '用户：现在几点了？ -> 使用此工具获取当前时间',
          '用户：获取当前时间戳 -> 使用此工具指定format为unix',
          '用户：获取ISO格式的时间 -> 使用此工具指定format为iso',
          '用户：获取北京时间 -> 使用此工具指定timezone为Asia/Shanghai'
        ],
        alternativeTools: [],
        performanceNotes: '此工具执行速度极快，几乎无性能开销。不支持缓存，因为时间每次都不同。可以高频调用。'
      }
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
          format: {
            type: 'string',
            description: '时间格式：iso(ISO 8601), unix(Unix时间戳), local(本地时间), date(日期), time(时间), datetime(日期时间)',
            enum: ['iso', 'unix', 'local', 'date', 'time', 'datetime'],
            default: 'iso'
          },
          timezone: {
            type: 'string',
            description: '时区，例如：Asia/Shanghai, America/New_York, UTC',
            default: 'local'
          }
        },
        required: []
      }
    };
  }

  async execute(parameters: Record<string, any>): Promise<any> {
    const { format = 'iso', timezone = 'local' } = parameters;

    try {
      const now = new Date();
      let result: any = {
        timestamp: now.getTime(),
        timezone: timezone === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone : timezone
      };

      switch (format) {
        case 'iso':
          result.formatted = now.toISOString();
          result.format = 'iso';
          break;
        case 'unix':
          result.formatted = Math.floor(now.getTime() / 1000);
          result.format = 'unix';
          break;
        case 'local':
          result.formatted = now.toLocaleString();
          result.format = 'local';
          break;
        case 'date':
          result.formatted = now.toLocaleDateString();
          result.format = 'date';
          break;
        case 'time':
          result.formatted = now.toLocaleTimeString();
          result.format = 'time';
          break;
        case 'datetime':
          result.formatted = now.toLocaleString();
          result.format = 'datetime';
          break;
        default:
          result.formatted = now.toISOString();
          result.format = 'iso';
      }

      if (timezone !== 'local') {
        try {
          const options: Intl.DateTimeFormatOptions = {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          };
          result.timezoneTime = new Date(now.toLocaleString('en-US', options));
          result.timezoneFormatted = now.toLocaleString('zh-CN', { ...options, timeZone: timezone });
        } catch (error) {
          logger.warn({ timezone, error }, '时区转换失败，使用本地时间');
        }
      }

      logger.info({ format, timezone, result }, '获取当前时间成功');

      return result;

    } catch (error: any) {
      logger.error({ format, timezone, error: error.message }, '获取当前时间时发生错误');

      throw new StandardToolError(
        ToolErrorType.INTERNAL_ERROR,
        `获取当前时间失败: ${error.message}`,
        'GET_TIME_FAILED',
        { format, timezone, originalError: error.toString() }
      );
    }
  }
}

// 导出所有标准化工具
export const standardizedTools = [
  new ListNotebooksTool(),
  new CreateDocumentTool(),
  new RecursiveSearchTool(),
  new BatchReadDocumentsTool(),
  new SetBlockAttrsTool(),
  new GetBlockAttrsTool(),
  new RenderTemplateTool(),
  new RenderSprigTemplateTool(),
  new ExportMarkdownTool(),
  new ExportFileTool(),
  new ExportExpandTool(),
  new GetCurrentTimeTool()
];

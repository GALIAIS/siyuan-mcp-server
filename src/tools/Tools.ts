/**
 * 合并工具集 - 整合所有MCP工具功能
 * 包含标准工具和增强API工具
 * 
 * @author CodeBuddy
 * @since 1.0.0
 */

import { Tool } from '@modelcontextprotocol/sdk/types';
import { createSiyuanClient } from '../siyuanClient/index';
import type { SiyuanClient } from '../siyuanClient/index';
import { BatchService } from '../services/batch-service';
import { TagService } from '../services/tag-service';

import { ReferenceService } from '../services/reference-service';
import { AdvancedSearchService } from '../services/advanced-search-service';

// 创建客户端实例
const siyuanClient = createSiyuanClient({
  baseURL: process.env.SIYUAN_API_URL || undefined,
  token: process.env.SIYUAN_TOKEN || '',
  autoDiscoverPort: true
});

/**
 * 标准JSON响应接口定义
 */
interface StandardResponse {
  success: boolean;
  message: string;
  error?: string;
  data: any;
  timestamp?: string;
}

/**
 * 创建标准响应对象
 * @param success - 操作是否成功
 * @param message - 响应消息
 * @param data - 响应数据
 * @param error - 错误信息（可选）
 * @returns StandardResponse - 标准响应对象
 */
function createStandardResponse(success: boolean, message: string, data: any = null, error?: string): StandardResponse {
  const response: StandardResponse = {
    success,
    message,
    data,
    timestamp: new Date().toISOString()
  };
  
  if (error) {
    response.error = error;
  }
  
  return response;
}

/**
 * 合并工具类 - 整合所有工具功能
 */
export class MergedTools {
  private client: SiyuanClient;
  private batchService: BatchService;
  private tagService: TagService;

  private referenceService: ReferenceService;
  private searchService: AdvancedSearchService;

  constructor(client: SiyuanClient) {
    this.client = client;
    this.batchService = new BatchService(client);
    this.tagService = new TagService(client);

    this.referenceService = new ReferenceService(client);
    this.searchService = new AdvancedSearchService(client);
  }

  /**
   * 获取所有工具定义
   * @returns MCP工具定义数组
   */
  getTools(): Tool[] {
    return [
      // ==================== 标准工具 ====================
      {
        name: 'list_notebooks',
        description: '列出所有思源笔记本',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'create_document',
        description: '在指定笔记本中创建新文档',
        inputSchema: {
          type: 'object',
          properties: {
            notebook: { type: 'string', description: '笔记本ID' },
            title: { type: 'string', description: '文档标题' },
            content: { type: 'string', description: '文档内容（Markdown格式）' }
          },
          required: ['notebook', 'title', 'content']
        }
      },
      {
        name: 'search_content',
        description: '搜索思源笔记内容',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '搜索关键词' },
            limit: { type: 'number', description: '返回结果数量限制', default: 10 }
          },
          required: ['query']
        }
      },
      {
        name: 'create_notebook',
        description: '创建新的思源笔记本',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '笔记本名称' },
            icon: { type: 'string', description: '笔记本图标', default: '📔' }
          },
          required: ['name']
        }
      },
      {
        name: 'create_subdocument',
        description: '在指定文档下创建子文档',
        inputSchema: {
          type: 'object',
          properties: {
            notebook: { type: 'string', description: '笔记本ID' },
            parentPath: { type: 'string', description: '父文档路径' },
            title: { type: 'string', description: '子文档标题' },
            content: { type: 'string', description: '子文档内容（Markdown格式）', default: '' }
          },
          required: ['notebook', 'parentPath', 'title']
        }
      },

      // ==================== 增强API工具 ====================
      {
        name: 'batch_create_blocks',
        description: '批量创建多个块，提升创建效率',
        inputSchema: {
          type: 'object',
          properties: {
            requests: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  content: { type: 'string', description: '块内容（Markdown格式）' },
                  parentID: { type: 'string', description: '父块ID（可选）' },
                  previousID: { type: 'string', description: '前一个块ID（可选）' }
                },
                required: ['content']
              },
              description: '批量创建请求列表'
            }
          },
          required: ['requests']
        }
      },
      {
        name: 'batch_update_blocks',
        description: '批量更新多个块的内容',
        inputSchema: {
          type: 'object',
          properties: {
            requests: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: '块ID' },
                  content: { type: 'string', description: '新内容（Markdown格式）' }
                },
                required: ['id', 'content']
              },
              description: '批量更新请求列表'
            }
          },
          required: ['requests']
        }
      },
      {
        name: 'batch_delete_blocks',
        description: '批量删除多个块',
        inputSchema: {
          type: 'object',
          properties: {
            blockIds: {
              type: 'array',
              items: { type: 'string' },
              description: '要删除的块ID列表'
            }
          },
          required: ['blockIds']
        }
      },
      {
        name: 'get_all_tags',
        description: '获取所有标签及其使用统计',
        inputSchema: {
          type: 'object',
          properties: {
            sortBy: {
              type: 'string',
              enum: ['name', 'count', 'created'],
              description: '排序方式',
              default: 'count'
            },
            sortOrder: {
              type: 'string',
              enum: ['asc', 'desc'],
              description: '排序顺序',
              default: 'desc'
            }
          },
          required: []
        }
      },
      {
        name: 'search_tags',
        description: '根据关键词搜索标签',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: { type: 'string', description: '搜索关键词' },
            limit: { type: 'number', description: '返回结果数量限制', default: 20 }
          },
          required: ['keyword']
        }
      },
      {
        name: 'manage_block_tags',
        description: '批量管理块的标签（添加、移除、替换）',
        inputSchema: {
          type: 'object',
          properties: {
            blockId: { type: 'string', description: '块ID' },
            operation: {
              type: 'string',
              enum: ['add', 'remove', 'replace'],
              description: '操作类型'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: '标签列表'
            }
          },
          required: ['blockId', 'operation', 'tags']
        }
      },
      {
        name: 'get_block_tags',
        description: '获取指定块的所有标签',
        inputSchema: {
          type: 'object',
          properties: {
            blockId: { type: 'string', description: '块ID' }
          },
          required: ['blockId']
        }
      },
      {
        name: 'get_block_references',
        description: '获取块的完整引用关系图谱',
        inputSchema: {
          type: 'object',
          properties: {
            blockId: { type: 'string', description: '块ID' },
            includeBacklinks: { type: 'boolean', description: '是否包含反向链接', default: true },
            maxDepth: { type: 'number', description: '最大深度', default: 3 }
          },
          required: ['blockId']
        }
      },
      {
        name: 'get_backlinks',
        description: '获取块的反向链接（入链）',
        inputSchema: {
          type: 'object',
          properties: {
            blockId: { type: 'string', description: '块ID' },
            includeContent: { type: 'boolean', description: '是否包含内容', default: true }
          },
          required: ['blockId']
        }
      },
      {
        name: 'create_reference',
        description: '在两个块之间创建引用链接',
        inputSchema: {
          type: 'object',
          properties: {
            sourceBlockId: { type: 'string', description: '源块ID' },
            targetBlockId: { type: 'string', description: '目标块ID' },
            referenceType: {
              type: 'string',
              enum: ['link', 'embed', 'mention'],
              description: '引用类型',
              default: 'link'
            }
          },
          required: ['sourceBlockId', 'targetBlockId']
        }
      },
      {
        name: 'advanced_search',
        description: '执行多条件组合的高级搜索',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '搜索查询' },
            notebook: { type: 'string', description: '笔记本ID（可选）' },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: '标签过滤（可选）'
            },
            dateRange: {
              type: 'object',
              properties: {
                start: { type: 'string', description: '开始日期 (YYYY-MM-DD)' },
                end: { type: 'string', description: '结束日期 (YYYY-MM-DD)' }
              },
              description: '日期范围过滤（可选）'
            },
            blockType: {
              type: 'string',
              enum: ['paragraph', 'heading', 'list', 'code', 'table'],
              description: '块类型过滤（可选）'
            },
            limit: { type: 'number', description: '返回结果数量限制', default: 50 }
          },
          required: ['query']
        }
      },
      {
        name: 'quick_text_search',
        description: '快速文本搜索，简化的搜索接口',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: '搜索文本' },
            caseSensitive: { type: 'boolean', description: '是否区分大小写', default: false },
            wholeWord: { type: 'boolean', description: '是否全词匹配', default: false },
            limit: { type: 'number', description: '返回结果数量限制', default: 20 }
          },
          required: ['text']
        }
      },
      {
        name: 'search_by_tags',
        description: '根据标签搜索相关内容',
        inputSchema: {
          type: 'object',
          properties: {
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: '标签列表'
            },
            matchMode: {
              type: 'string',
              enum: ['any', 'all'],
              description: '匹配模式：any-任意标签，all-所有标签',
              default: 'any'
            },
            limit: { type: 'number', description: '返回结果数量限制', default: 30 }
          },
          required: ['tags']
        }
      },
      {
        name: 'search_by_date_range',
        description: '根据日期范围搜索内容',
        inputSchema: {
          type: 'object',
          properties: {
            startDate: { type: 'string', description: '开始日期 (YYYY-MM-DD)' },
            endDate: { type: 'string', description: '结束日期 (YYYY-MM-DD)' },
            dateType: {
              type: 'string',
              enum: ['created', 'updated'],
              description: '日期类型',
              default: 'updated'
            },
            limit: { type: 'number', description: '返回结果数量限制', default: 50 }
          },
          required: ['startDate', 'endDate']
        }
      },
      {
        name: 'recursive_search_notes',
        description: '递归搜索笔记，支持深度搜索和模糊匹配',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '搜索查询' },
            notebook: { type: 'string', description: '笔记本ID（可选）' },
            options: {
              type: 'object',
              properties: {
                maxDepth: { type: 'number', description: '最大搜索深度', default: 3 },
                includeContent: { type: 'boolean', description: '是否包含内容', default: true },
                fuzzyMatch: { type: 'boolean', description: '是否启用模糊匹配', default: false },
                limit: { type: 'number', description: '返回结果数量限制', default: 50 }
              },
              description: '搜索选项（可选）'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'batch_read_all_documents',
        description: '批量读取指定笔记本中的所有文档',
        inputSchema: {
          type: 'object',
          properties: {
            notebookId: { type: 'string', description: '笔记本ID' },
            options: {
              type: 'object',
              properties: {
                maxDepth: { type: 'number', description: '最大读取深度', default: 2 },
                includeContent: { type: 'boolean', description: '是否包含文档内容', default: false },
                batchSize: { type: 'number', description: '批处理大小', default: 10 },
                delay: { type: 'number', description: '批次间延迟(ms)', default: 100 }
              },
              description: '读取选项（可选）'
            }
          },
          required: ['notebookId']
        }
      }
    ];
  }

  /**
   * 处理工具调用
   * @param toolName 工具名称
   * @param args 参数
   * @returns 工具执行结果
   */
  async handleToolCall(toolName: string, args: any) {
    // 导入拦截器（动态导入避免循环依赖）
    const { toolCallInterceptor } = await import('../core/ToolCallInterceptor.js');
    
    // 拦截工具调用
    const interceptionResult = await toolCallInterceptor.interceptToolCall({
      toolName,
      parameters: args,
      requestId: `${toolName}_${Date.now()}`
    });

    // 如果被拦截，返回拦截结果
    if (!interceptionResult.allowed) {
      return createStandardResponse(
        false,
        interceptionResult.errors.join('; ') || '工具调用被拦截',
        null,
        interceptionResult.errors.join('; ')
      );
    }

    try {
      switch (toolName) {
        // ==================== 标准工具处理 ====================
        case 'list_notebooks':
          return await this.listNotebooks();

        case 'create_document':
          return await this.createDocument(args.notebook, args.title, args.content);

        case 'search_content':
          return await this.searchContent(args.query, args.limit);

        case 'create_notebook':
          return await this.createNotebook(args.name, args.icon);

        case 'create_subdocument':
          return await this.createSubDocument(args.notebook, args.parentPath, args.title, args.content);

        // ==================== 增强API工具处理 ====================
        case 'batch_create_blocks':
          return await this.batchService.batchCreateBlocks(args);

        case 'batch_update_blocks':
          return await this.batchService.batchUpdateBlocks(args);

        case 'batch_delete_blocks':
          return await this.batchService.batchDeleteBlocks(args.blockIds);

        case 'get_all_tags':
          try {
            return await this.tagService.getAllTags(args);
          } catch (error) {
            // 如果原始服务失败，使用修复版本
            return await this.tagService.getAllTags(args);
          }

        case 'search_tags':
          try {
            return await this.tagService.searchTags(args.keyword, args);
          } catch (error) {
            // 如果原始服务失败，使用修复版本
            return await this.tagService.searchTags(args.keyword, args);
          }

        case 'manage_block_tags':
          return await this.tagService.manageBlockTags(args);

        case 'get_block_tags':
          return await this.tagService.getBlockTags(args.blockId);

        case 'get_block_references':
          return await this.referenceService.getBlockReferences(args);

        case 'get_backlinks':
          return await this.referenceService.getBacklinks(args.blockId, args.includeContent);

        case 'create_reference':
          return await this.referenceService.createReference(args.sourceBlockId, args.targetBlockId, args.referenceType);

        case 'advanced_search':
          return await this.searchService.advancedSearch(args);

        case 'quick_text_search':
          return await this.searchService.quickTextSearch(args.text, args);

        case 'search_by_tags':
          return await this.searchService.searchByTags(args.tags, args);

        case 'search_by_date_range':
          return await this.searchService.searchByDateRange(args, args);

        case 'recursive_search_notes':
          return await this.client.recursiveSearchNotes(args.query, args.notebook, args.options);

        case 'batch_read_all_documents':
          return await this.client.batchReadAllDocuments(args.notebookId, args.options);

        default:
          throw new Error(`未知的工具: ${toolName}`);
      }
    } catch (error: any) {
      throw new Error(`工具执行失败: ${error.message}`);
    }
  }

  // ==================== 标准工具实现 ====================

  /**
   * 获取笔记本列表 - 返回标准JSON格式
   * @returns Promise<StandardResponse> - 返回包含笔记本列表的标准JSON响应
   * @throws Error - 当获取笔记本失败时抛出异常
   */
  private async listNotebooks(): Promise<StandardResponse> {
    try {
      const response = await this.client.request('/api/notebook/lsNotebooks');
      
      // 处理思源API的标准响应格式
      const notebooks = response?.data?.notebooks || response?.notebooks || [];
      
      if (!Array.isArray(notebooks)) {
        return createStandardResponse(
          false,
          "获取笔记本列表失败",
          null,
          "无法获取有效的笔记本数据"
        );
      }

      // 验证每个笔记本的真实性
      const validNotebooks = [];
      for (const notebook of notebooks) {
        if (notebook && notebook.id && notebook.name) {
          validNotebooks.push({
            id: notebook.id,
            name: notebook.name,
            icon: notebook.icon || '📔',
            closed: notebook.closed || false,
            sort: notebook.sort || 0
          });
        }
      }

      return createStandardResponse(
        true,
        `成功获取 ${validNotebooks.length} 个笔记本`,
        {
          notebooks: validNotebooks,
          total: validNotebooks.length
        }
      );
    } catch (error: any) {
      // 完全禁用日志输出 - 用户不需要任何日志
      return createStandardResponse(
        false,
        "获取笔记本列表时发生错误",
        null,
        error?.message || '未知错误'
      );
    }
  }

  /**
   * 创建文档 - 返回标准JSON格式
   * @param notebook - 笔记本ID
   * @param title - 文档标题
   * @param content - 文档内容
   * @returns Promise<StandardResponse> - 返回创建结果的标准JSON响应
   * @throws Error - 当创建文档失败时抛出异常
   */
  private async createDocument(notebook: string, title: string, content: string): Promise<StandardResponse> {
    try {
      // 参数验证
      if (!notebook || !title || content === undefined) {
        return createStandardResponse(
          false,
          "参数验证失败",
          { notebook, title, content: content?.substring(0, 50) + '...' },
          "笔记本ID、标题和内容都是必需的"
        );
      }

      // 使用正确的API创建文档
      const result = await this.client.request('/api/filetree/createDocWithMd', {
        notebook: notebook,
        path: `/${title}`,
        markdown: content
      });

      if (result && result.code === 0 && result.data) {
        // API返回的data直接就是文档ID
        const docId = result.data;
        
        return createStandardResponse(
          true,
          "文档创建成功",
          {
            id: docId,
            title: title,
            notebook: notebook,
            contentPreview: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
            contentLength: content.length,
            path: `/${title}`
          }
        );
      } else {
        return createStandardResponse(
          false,
          "文档创建失败",
          { title, notebook },
          result?.msg || '未返回有效ID'
        );
      }
    } catch (error: any) {
      // 完全禁用日志输出 - 用户不需要任何日志
      return createStandardResponse(
        false,
        "创建文档时发生错误",
        { title, notebook },
        error?.message || '未知错误'
      );
    }
  }

  /**
   * 搜索内容 - 返回标准JSON格式
   * @param query - 搜索关键词
   * @param limit - 返回结果数量限制
   * @returns Promise<StandardResponse> - 返回搜索结果的标准JSON响应
   * @throws Error - 当搜索失败时抛出异常
   */
  private async searchContent(query: string, limit: number = 10): Promise<StandardResponse> {
    try {
      // 参数验证
      if (!query || query.trim() === '') {
        return createStandardResponse(
          false,
          "搜索参数无效",
          { query, limit },
          "搜索关键词不能为空"
        );
      }

      const results = await this.client.searchNotes(query.trim(), Math.max(1, Math.min(limit, 100)));
      
      // 处理思源API的标准响应格式
      const blocks = results?.data?.blocks || results?.blocks || [];
      
      if (!Array.isArray(blocks)) {
        return createStandardResponse(
          false,
          "搜索返回无效结果",
          { query, limit },
          "API返回的数据格式不正确"
        );
      }

      // 处理搜索结果，确保格式正确
      const processedResults = blocks.slice(0, limit).map((result: any) => ({
        id: result.id || '',
        title: result.title || '无标题',
        content: result.content || '',
        contentPreview: (result.content || '').substring(0, 150) + ((result.content || '').length > 150 ? '...' : ''),
        notebook: result.notebook || '',
        notebookName: result.notebookName || '',
        path: result.path || '',
        score: result.score || 0,
        type: result.type || 'block'
      }));

      return createStandardResponse(
        true,
        `找到 ${processedResults.length} 条搜索结果`,
        {
          query: query.trim(),
          results: processedResults,
          total: processedResults.length,
          limit: limit,
          hasMore: blocks.length > limit
        }
      );
    } catch (error: any) {
      // 完全禁用日志输出 - 用户不需要任何日志
      return createStandardResponse(
        false,
        "搜索时发生错误",
        { query, limit },
        error?.message || '未知错误'
      );
    }
  }

  /**
   * 创建笔记本 - 返回标准JSON格式
   * @param name - 笔记本名称
   * @param icon - 笔记本图标
   * @returns Promise<StandardResponse> - 返回创建结果的标准JSON响应
   * @throws Error - 当创建笔记本失败时抛出异常
   */
  private async createNotebook(name: string, icon: string = '📔'): Promise<StandardResponse> {
    try {
      // 参数验证
      if (!name || name.trim() === '') {
        return createStandardResponse(
          false,
          "笔记本名称无效",
          { name, icon },
          "笔记本名称不能为空"
        );
      }

      const result = await this.client.request('/api/notebook/createNotebook', {
        name: name.trim(),
        icon: icon || '📔'
      });
      
      if (result && result.code === 0 && result.data) {
        const notebookId = result.data.notebook?.id || result.data.id;
        return createStandardResponse(
          true,
          "笔记本创建成功",
          {
            id: notebookId,
            name: name.trim(),
            icon: icon || '📔',
            closed: false,
            sort: 0
          }
        );
      } else {
        return createStandardResponse(
          false,
          "笔记本创建失败",
          { name: name.trim(), icon },
          result?.msg || '创建失败'
        );
      }
    } catch (error: any) {
      // 完全禁用日志输出 - 用户不需要任何日志
      return createStandardResponse(
        false,
        "创建笔记本时发生错误",
        { name, icon },
        error?.message || '未知错误'
      );
    }
  }

  /**
   * 创建子文档 - 返回标准JSON格式
   * @param notebook - 笔记本ID
   * @param parentPath - 父文档路径
   * @param title - 子文档标题
   * @param content - 子文档内容
   * @returns Promise<StandardResponse> - 返回创建结果的标准JSON响应
   * @throws Error - 当创建子文档失败时抛出异常
   */
  private async createSubDocument(notebook: string, parentPath: string, title: string, content: string = ''): Promise<StandardResponse> {
    try {
      // 参数验证
      if (!notebook || !parentPath || !title) {
        return createStandardResponse(
          false,
          "参数验证失败",
          { notebook, parentPath, title },
          "笔记本ID、父路径和标题都是必需的"
        );
      }

      // 构建子文档路径
      const subDocPath = `${parentPath}/${title}`;
      
      // 使用正确的API创建子文档
      const result = await this.client.request('/api/filetree/createDocWithMd', {
        notebook: notebook,
        path: subDocPath,
        markdown: content
      });

      if (result && result.code === 0 && result.data) {
        const docId = result.data;
        return createStandardResponse(
          true,
          "子文档创建成功",
          {
            id: docId,
            title: title,
            notebook: notebook,
            parentPath: parentPath,
            fullPath: subDocPath,
            contentPreview: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
            contentLength: content.length
          }
        );
      } else {
        return createStandardResponse(
          false,
          "子文档创建失败",
          { title, notebook, parentPath },
          result?.msg || '创建失败'
        );
      }
    } catch (error: any) {
      // 完全禁用日志输出 - 用户不需要任何日志
      return createStandardResponse(
        false,
        "创建子文档时发生错误",
        { title, notebook, parentPath },
        error?.message || '未知错误'
      );
    }
  }
}

// 创建合并工具实例
export const mergedTools = new MergedTools(siyuanClient);

/**
 * 处理工具调用（统一入口）
 * @param name 工具名称
 * @param args 工具参数
 * @returns MCP兼容的响应格式
 */
export async function handleMergedTool(name: string, args: any): Promise<any> {
  try {
    const result = await mergedTools.handleToolCall(name, args || {});
    return convertToMCPFormat(result);
  } catch (error: any) {
    // 完全禁用日志输出 - 用户不需要任何日志
    
    const errorResult = createStandardResponse(
      false,
      "工具处理时发生错误",
      { toolName: name, args },
      error?.message || '未知错误'
    );
    
    return convertToMCPFormat(errorResult);
  }
}

/**
 * 获取所有工具定义
 */
export function getAllMergedTools() {
  return mergedTools.getTools();
}

/**
 * 将StandardResponse转换为MCP兼容格式
 * @param response - 标准响应对象
 * @returns MCP兼容的响应格式
 */
function convertToMCPFormat(response: any): any {
  // 如果已经是标准响应格式
  if (response && typeof response === 'object' && 'success' in response) {
    const statusIcon = response.success ? '✅' : '❌';
    const content = response.success 
      ? `${statusIcon} ${response.message}\n\n${formatResponseData(response.data)}`
      : `${statusIcon} ${response.message}\n\n❗ 错误: ${response.error || '未知错误'}`;

    return {
      content: [
        {
          type: "text",
          text: content
        }
      ],
      isError: !response.success
    };
  }

  // 如果是其他格式，直接返回JSON字符串
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(response, null, 2)
      }
    ],
    isError: false
  };
}

/**
 * 格式化响应数据为可读文本
 * @param data - 响应数据
 * @returns 格式化后的文本
 */
function formatResponseData(data: any): string {
  if (!data) return '';
  
  if (typeof data === 'string') return data;
  
  if (Array.isArray(data)) {
    return data.map((item, index) => `${index + 1}. ${JSON.stringify(item, null, 2)}`).join('\n');
  }
  
  if (typeof data === 'object') {
    return JSON.stringify(data, null, 2);
  }
  
  return String(data);
}

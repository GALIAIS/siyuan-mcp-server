/**
 * 高级搜索服务
 * 提供多条件组合搜索、分面搜索和智能搜索功能
 * 
 * @author CodeBuddy
 * @since 1.0.0
 */

import { SiyuanClient } from '../siyuanClient';
import {
  AdvancedSearchRequest,
  AdvancedSearchResponse,
  AdvancedSearchQuery,
  AdvancedSearchOptions,
  SearchResultItem
} from '../interfaces';

export class AdvancedSearchService {
  private client: SiyuanClient;

  /**
   * 构造函数
   * @param client - 思源客户端实例
   */
  constructor(client: SiyuanClient) {
    this.client = client;
  }

  /**
   * 执行高级搜索
   * 
   * @param request - 高级搜索请求
   * @returns {Promise<AdvancedSearchResponse>} 搜索结果
   * 
   * @throws {Error} 当搜索参数无效时抛出
   * @throws {Error} 当搜索执行失败时抛出
   * 
   * @example
   * ```typescript
   * const searchService = new AdvancedSearchService(client);
   * const results = await searchService.advancedSearch({
   *   query: {
   *     text: '机器学习',
   *     tags: ['AI', '算法'],
   *     notebooks: ['技术笔记'],
   *     dateRange: {
   *       field: 'updated',
   *       start: '2024-01-01',
   *       end: '2024-12-31'
   *     }
   *   },
   *   options: {
   *     limit: 20,
   *     sortBy: 'relevance',
   *     includeContext: true,
   *     highlightMatches: true
   *   }
   * });
   * ```
   */
  async advancedSearch(request: AdvancedSearchRequest): Promise<AdvancedSearchResponse> {
    const startTime = Date.now();
    
    try {
      // 验证搜索参数
      this.validateSearchRequest(request);

      // 构建搜索SQL
      const sql = this.buildSearchSQL(request.query, request.options);
      
      // 执行搜索
      const response = await this.client.sql({ stmt: sql });
      
      if (response.code !== 0) {
        throw new Error(`搜索执行失败: ${response.msg}`);
      }

      // 处理搜索结果
      const results = await this.processSearchResults(
        response.data || [], 
        request.options
      );

      // 计算分面统计（如果需要）
      const facets = request.options.includeContext 
        ? await this.calculateFacets(request.query)
        : undefined;

      const searchTime = Date.now() - startTime;

      return {
        code: 0,
        msg: '搜索完成',
        data: {
          results,
          total: results.length,
          hasMore: results.length === (request.options.limit || 50),
          searchTime,
          facets
        }
      };
    } catch (error) {
      throw new Error(`高级搜索失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 快速文本搜索
   * 
   * @param text - 搜索文本
   * @param options - 搜索选项
   * @returns {Promise<SearchResultItem[]>} 搜索结果
   * 
   * @example
   * ```typescript
   * const results = await searchService.quickTextSearch('JavaScript', {
   *   limit: 10,
   *   highlightMatches: true
   * });
   * ```
   */
  async quickTextSearch(
    text: string, 
    options: Partial<AdvancedSearchOptions> = {}
  ): Promise<SearchResultItem[]> {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('搜索文本不能为空');
      }

      const request: AdvancedSearchRequest = {
        query: { text: text.trim() },
        options: {
          limit: 20,
          sortBy: 'relevance',
          includeContext: true,
          highlightMatches: true,
          ...options
        }
      };

      const response = await this.advancedSearch(request);
      return response.data.results;
    } catch (error) {
      throw new Error(`快速搜索失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 按标签搜索
   * 
   * @param tags - 标签数组
   * @param options - 搜索选项
   * @returns {Promise<SearchResultItem[]>} 搜索结果
   * 
   * @example
   * ```typescript
   * const results = await searchService.searchByTags(['编程', 'Python'], {
   *   limit: 15,
   *   sortBy: 'updated'
   * });
   * ```
   */
  async searchByTags(
    tags: string[], 
    options: Partial<AdvancedSearchOptions> = {}
  ): Promise<SearchResultItem[]> {
    try {
      if (!tags || tags.length === 0) {
        throw new Error('标签数组不能为空');
      }

      const request: AdvancedSearchRequest = {
        query: { tags },
        options: {
          limit: 20,
          sortBy: 'updated',
          sortOrder: 'desc',
          includeContext: true,
          ...options
        }
      };

      const response = await this.advancedSearch(request);
      return response.data.results;
    } catch (error) {
      throw new Error(`标签搜索失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 按日期范围搜索
   * 
   * @param dateRange - 日期范围
   * @param options - 搜索选项
   * @returns {Promise<SearchResultItem[]>} 搜索结果
   */
  async searchByDateRange(
    dateRange: {
      field: 'created' | 'updated';
      start?: string;
      end?: string;
    },
    options: Partial<AdvancedSearchOptions> = {}
  ): Promise<SearchResultItem[]> {
    try {
      const request: AdvancedSearchRequest = {
        query: { dateRange },
        options: {
          limit: 50,
          sortBy: dateRange.field,
          sortOrder: 'desc',
          includeContext: false,
          ...options
        }
      };

      const response = await this.advancedSearch(request);
      return response.data.results;
    } catch (error) {
      throw new Error(`日期范围搜索失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 验证搜索请求参数
   */
  private validateSearchRequest(request: AdvancedSearchRequest): void {
    if (!request.query) {
      throw new Error('搜索查询不能为空');
    }

    const { query, options } = request;

    // 验证至少有一个搜索条件
    const hasSearchCondition = !!(
      query.text ||
      (query.tags && query.tags.length > 0) ||
      (query.notebooks && query.notebooks.length > 0) ||
      query.dateRange ||
      (query.blockTypes && query.blockTypes.length > 0) ||
      query.hasReferences !== undefined ||
      query.author ||
      query.language
    );

    if (!hasSearchCondition) {
      throw new Error('至少需要一个搜索条件');
    }

    // 验证选项
    if (options.limit && (options.limit < 1 || options.limit > 1000)) {
      throw new Error('搜索结果限制必须在1-1000之间');
    }

    if (options.offset && options.offset < 0) {
      throw new Error('偏移量不能为负数');
    }
  }

  /**
   * 构建搜索SQL
   */
  private buildSearchSQL(query: AdvancedSearchQuery, options: AdvancedSearchOptions): string {
    const conditions: string[] = [];
    const joins: string[] = [];

    // 基础查询
    let sql = `
      SELECT DISTINCT
        b.id as blockID,
        b.content,
        b.markdown,
        b.created,
        b.updated,
        b.type as blockType,
        d.content as docTitle,
        n.name as notebookName
      FROM blocks b
      LEFT JOIN blocks d ON b.root_id = d.id AND d.type = 'document'
      LEFT JOIN (
        SELECT id, name FROM blocks WHERE type = 'notebook'
      ) n ON b.box = n.id
    `;

    // 文本搜索条件
    if (query.text) {
      const searchText = query.text.replace(/'/g, "''"); // SQL转义
      conditions.push(`(
        b.content LIKE '%${searchText}%' OR 
        b.markdown LIKE '%${searchText}%'
      )`);
    }

    // 标签过滤
    if (query.tags && query.tags.length > 0) {
      const tagConditions = query.tags.map(tag => 
        `(b.content LIKE '%#${tag.replace(/'/g, "''")}%' OR b.markdown LIKE '%#${tag.replace(/'/g, "''")}%')`
      );
      conditions.push(`(${tagConditions.join(' OR ')})`);
    }

    // 笔记本过滤
    if (query.notebooks && query.notebooks.length > 0) {
      const notebookConditions = query.notebooks.map(notebook => 
        `n.name = '${notebook.replace(/'/g, "''")}'`
      );
      conditions.push(`(${notebookConditions.join(' OR ')})`);
    }

    // 日期范围过滤
    if (query.dateRange) {
      const { field, start, end } = query.dateRange;
      if (start) {
        conditions.push(`b.${field} >= '${start}'`);
      }
      if (end) {
        conditions.push(`b.${field} <= '${end}'`);
      }
    }

    // 块类型过滤
    if (query.blockTypes && query.blockTypes.length > 0) {
      const typeConditions = query.blockTypes.map(type => 
        `b.type = '${type.replace(/'/g, "''")}'`
      );
      conditions.push(`(${typeConditions.join(' OR ')})`);
    }

    // 引用过滤
    if (query.hasReferences !== undefined) {
      if (query.hasReferences) {
        conditions.push(`(
          b.content LIKE '%((''%''))%' OR 
          b.markdown LIKE '%[%](%'
        )`);
      } else {
        conditions.push(`(
          b.content NOT LIKE '%((''%''))%' AND 
          b.markdown NOT LIKE '%[%](%'
        )`);
      }
    }

    // 添加WHERE子句
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // 添加排序
    const sortField = this.getSortField(options.sortBy || 'relevance');
    const sortOrder = (options.sortOrder || 'desc').toUpperCase();
    sql += ` ORDER BY ${sortField} ${sortOrder}`;

    // 添加分页
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    sql += ` LIMIT ${limit} OFFSET ${offset}`;

    return sql;
  }

  /**
   * 获取排序字段
   */
  private getSortField(sortBy: string): string {
    switch (sortBy) {
      case 'created':
        return 'b.created';
      case 'updated':
        return 'b.updated';
      case 'title':
        return 'd.content';
      case 'relevance':
      default:
        return 'b.updated'; // 默认按更新时间排序
    }
  }

  /**
   * 处理搜索结果
   */
  private async processSearchResults(
    rawResults: any[], 
    options: AdvancedSearchOptions
  ): Promise<SearchResultItem[]> {
    const results: SearchResultItem[] = [];

    for (const row of rawResults) {
      const result: SearchResultItem = {
        blockID: row.blockID,
        docID: row.root_id || row.blockID,
        content: this.truncateContent(row.content || ''),
        score: 1.0, // 简化的相关性评分
        metadata: {
          title: row.docTitle || '无标题',
          notebook: row.notebookName || '未知笔记本',
          created: row.created || '',
          updated: row.updated || '',
          blockType: row.blockType || 'paragraph',
          tags: this.extractTags(row.content || '')
        }
      };

      // 添加上下文
      if (options.includeContext) {
        result.context = this.extractContext(row.content || '', 50);
      }

      // 添加高亮
      if (options.highlightMatches && options.includeContext) {
        result.highlights = this.generateHighlights(row.content || '', '');
      }

      results.push(result);
    }

    return results;
  }

  /**
   * 计算分面统计
   */
  private async calculateFacets(query: AdvancedSearchQuery): Promise<any> {
    try {
      // 简化的分面统计实现
      return {
        notebooks: {},
        tags: {},
        blockTypes: {}
      };
    } catch (error) {
      console.error('计算分面统计失败:', error);
      return undefined;
    }
  }

  /**
   * 截断内容
   */
  private truncateContent(content: string, maxLength: number = 200): string {
    if (!content) return '';
    return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
  }

  /**
   * 提取标签
   */
  private extractTags(content: string): string[] {
    const tagRegex = /#([^\s#]+)/g;
    const tags: string[] = [];
    let match;

    while ((match = tagRegex.exec(content)) !== null) {
      const tag = match[1].trim();
      if (tag && !tags.includes(tag)) {
        tags.push(tag);
      }
    }

    return tags;
  }

  /**
   * 提取上下文
   */
  private extractContext(content: string, maxLength: number): string {
    return this.truncateContent(content, maxLength);
  }

  /**
   * 生成高亮片段
   */
  private generateHighlights(content: string, searchText: string): string[] {
    if (!searchText) return [];
    
    const highlights: string[] = [];
    const regex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let match;

    while ((match = regex.exec(content)) !== null && highlights.length < 3) {
      const start = Math.max(0, match.index - 30);
      const end = Math.min(content.length, match.index + match[0].length + 30);
      const highlight = content.substring(start, end);
      highlights.push(highlight);
    }

    return highlights;
  }
}
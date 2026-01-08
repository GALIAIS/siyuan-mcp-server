/**
 * 标签管理服务
 * 提供标签的创建、查询、管理和统计功能
 * 
 * @author CodeBuddy
 * @since 1.0.0
 */

import { SiyuanClient } from '../siyuanClient';
import {
  GetTagsResponse,
  ManageBlockTagsRequest,
  ManageBlockTagsResponse,
  TagInfo
} from '../interfaces';

export class TagService {
  private client: SiyuanClient;

  /**
   * 构造函数
   * @param client - 思源客户端实例
   */
  constructor(client: SiyuanClient) {
    this.client = client;
  }

  /**
   * 获取所有标签及其使用统计
   * 
   * @param options - 查询选项
   * @param options.sortBy - 排序字段 ('name' | 'count' | 'created' | 'lastUsed')
   * @param options.sortOrder - 排序顺序 ('asc' | 'desc')
   * @param options.limit - 限制结果数量
   * @param options.offset - 偏移量
   * @returns {Promise<GetTagsResponse>} 标签列表和统计信息
   * 
   * @throws {Error} 当网络请求失败时抛出
   * 
   * @example
   * ```typescript
   * const tagService = new TagService(client);
   * const tags = await tagService.getAllTags({
   *   sortBy: 'count',
   *   sortOrder: 'desc',
   *   limit: 50
   * });
   * console.log(`共找到 ${tags.data.total} 个标签`);
   * ```
   */
  async getAllTags(options: {
    sortBy?: 'name' | 'count' | 'created' | 'lastUsed';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  } = {}): Promise<GetTagsResponse> {
    try {
      // 使用SQL查询获取所有标签信息
      const sql = this.buildTagsQuery(options);
      const response = await this.client.sqlService.query(sql);

      if (response.code !== 0) {
        throw new Error(`查询标签失败: ${response.msg}`);
      }

      // 处理查询结果
      const tags: TagInfo[] = response.data.map((row: any) => ({
        name: row.tag_name,
        count: parseInt(row.usage_count) || 0,
        color: row.color || undefined,
        description: row.description || undefined,
        createdAt: row.created_at || new Date().toISOString(),
        lastUsed: row.last_used || new Date().toISOString()
      }));

      return {
        code: 0,
        msg: '获取标签成功',
        data: {
          tags,
          total: tags.length
        }
      };
    } catch (error) {
      throw new Error(`获取标签列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 搜索标签
   * 
   * @param keyword - 搜索关键词
   * @param options - 搜索选项
   * @returns {Promise<GetTagsResponse>} 匹配的标签列表
   * 
   * @throws {Error} 当搜索失败时抛出
   * 
   * @example
   * ```typescript
   * const results = await tagService.searchTags('编程', {
   *   limit: 10,
   *   includeDescription: true
   * });
   * ```
   */
  async searchTags(
    keyword: string,
    options: {
      limit?: number;
      includeDescription?: boolean;
      minUsageCount?: number;
    } = {}
  ): Promise<GetTagsResponse> {
    try {
      if (!keyword || keyword.trim().length === 0) {
        throw new Error('搜索关键词不能为空');
      }

      const sql = this.buildTagSearchQuery(keyword, options);
      const response = await this.client.sqlService.query(sql);

      if (response.code !== 0) {
        throw new Error(`搜索标签失败: ${response.msg}`);
      }

      const tags: TagInfo[] = response.data.map((row: any) => ({
        name: row.tag_name,
        count: parseInt(row.usage_count) || 0,
        color: row.color || undefined,
        description: row.description || undefined,
        createdAt: row.created_at || new Date().toISOString(),
        lastUsed: row.last_used || new Date().toISOString()
      }));

      return {
        code: 0,
        msg: '搜索标签成功',
        data: {
          tags,
          total: tags.length
        }
      };
    } catch (error) {
      throw new Error(`搜索标签失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 管理块的标签（添加、移除、替换）
   * 
   * @param request - 标签管理请求
   * @returns {Promise<ManageBlockTagsResponse>} 操作结果
   * 
   * @throws {Error} 当参数无效时抛出
   * @throws {Error} 当操作失败时抛出
   * 
   * @example
   * ```typescript
   * // 为多个块添加标签
   * const result = await tagService.manageBlockTags({
   *   blockIDs: ['block-1', 'block-2'],
   *   tags: ['重要', '待办'],
   *   operation: 'add'
   * });
   * 
   * // 替换块的所有标签
   * const result2 = await tagService.manageBlockTags({
   *   blockIDs: ['block-1'],
   *   tags: ['已完成'],
   *   operation: 'replace'
   * });
   * ```
   */
  async manageBlockTags(request: ManageBlockTagsRequest): Promise<ManageBlockTagsResponse> {
    try {
      // 验证请求参数
      this.validateManageTagsRequest(request);

      const failures: Array<{ blockID: string; error: string }> = [];
      let successCount = 0;

      // 处理每个块的标签操作
      for (const blockID of request.blockIDs) {
        try {
          await this.processBlockTagOperation(blockID, request.tags, request.operation);
          successCount++;
        } catch (error) {
          failures.push({
            blockID,
            error: error instanceof Error ? error.message : '未知错误'
          });
        }
      }

      return {
        code: 0,
        msg: '标签管理操作完成',
        data: {
          processedBlocks: request.blockIDs.length,
          successCount,
          failures
        }
      };
    } catch (error) {
      throw new Error(`管理块标签失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取块的所有标签
   * 
   * @param blockID - 块ID
   * @returns {Promise<string[]>} 标签列表
   * 
   * @throws {Error} 当获取失败时抛出
   * 
   * @example
   * ```typescript
   * const tags = await tagService.getBlockTags('block-id-123');
   * console.log('块的标签:', tags);
   * ```
   */
  async getBlockTags(blockID: string): Promise<string[]> {
    try {
      if (!blockID) {
        throw new Error('块ID不能为空');
      }

      // 获取块信息
      const blockResponse = await this.client.getBlockByID({ id: blockID });
      
      if (blockResponse.code !== 0) {
        throw new Error(`获取块信息失败: ${blockResponse.msg}`);
      }

      // 从块的markdown内容中提取标签
      const content = blockResponse.data?.markdown || '';
      const tags = this.extractTagsFromContent(content);

      return tags;
    } catch (error) {
      throw new Error(`获取块标签失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取使用指定标签的所有块
   * 
   * @param tagName - 标签名称
   * @param options - 查询选项
   * @returns {Promise<any[]>} 使用该标签的块列表
   * 
   * @throws {Error} 当查询失败时抛出
   * 
   * @example
   * ```typescript
   * const blocks = await tagService.getBlocksByTag('重要', {
   *   limit: 20,
   *   includeContent: true
   * });
   * ```
   */
  async getBlocksByTag(
    tagName: string,
    options: {
      limit?: number;
      offset?: number;
      includeContent?: boolean;
      sortBy?: 'created' | 'updated';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<any[]> {
    try {
      if (!tagName) {
        throw new Error('标签名称不能为空');
      }

      const sql = this.buildBlocksByTagQuery(tagName, options);
      const response = await this.client.sqlService.query(sql);

      if (response.code !== 0) {
        throw new Error(`查询标签块失败: ${response.msg}`);
      }

      return response.data || [];
    } catch (error) {
      throw new Error(`获取标签块失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取标签使用统计
   * 
   * @param timeRange - 时间范围 ('week' | 'month' | 'year' | 'all')
   * @returns 标签使用统计信息
   * 
   * @example
   * ```typescript
   * const stats = await tagService.getTagStatistics('month');
   * console.log('本月最常用标签:', stats.topTags);
   * ```
   */
  async getTagStatistics(timeRange: 'week' | 'month' | 'year' | 'all' = 'all') {
    try {
      const sql = this.buildTagStatisticsQuery(timeRange);
      const response = await this.client.sqlService.query(sql);

      if (response.code !== 0) {
        throw new Error(`获取标签统计失败: ${response.msg}`);
      }

      const data = response.data || [];
      
      return {
        totalTags: data.length,
        totalUsage: data.reduce((sum: number, item: any) => sum + (parseInt(item.usage_count) || 0), 0),
        topTags: data.slice(0, 10),
        timeRange,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`获取标签统计失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 构建标签查询SQL
   */
  private buildTagsQuery(options: any): string {
    const { sortBy = 'name', sortOrder = 'asc', limit, offset } = options;
    
    // 使用更简单和兼容的查询方式
    let sql = `
      SELECT 
        DISTINCT SUBSTR(content, 2) as tag_name,
        1 as usage_count,
        created as created_at,
        updated as last_used
      FROM blocks 
      WHERE content LIKE '#%' 
        AND content NOT LIKE '#%#%'
        AND LENGTH(TRIM(SUBSTR(content, 2))) > 0
    `;

    // 添加排序
    const sortFieldMap: { [key: string]: string } = {
      'name': 'tag_name',
      'count': 'usage_count',
      'created': 'created_at',
      'lastUsed': 'last_used'
    };
    const sortField = sortFieldMap[sortBy] || 'tag_name';

    sql += ` ORDER BY ${sortField} ${sortOrder.toUpperCase()}`;

    // 添加分页
    if (limit) {
      sql += ` LIMIT ${limit}`;
      if (offset) {
        sql += ` OFFSET ${offset}`;
      }
    }

    return sql;
  }

  /**
   * 构建标签搜索查询SQL
   */
  private buildTagSearchQuery(keyword: string, options: any): string {
    const { limit = 50, minUsageCount = 1 } = options;
    
    return `
      SELECT 
        DISTINCT TRIM(tag.content) as tag_name,
        COUNT(*) as usage_count,
        MIN(b.created) as created_at,
        MAX(b.updated) as last_used
      FROM blocks b
      JOIN (
        SELECT id, TRIM(SUBSTR(content, 2)) as content 
        FROM blocks 
        WHERE content LIKE '#%' AND type = 'tag'
      ) tag ON b.id = tag.id OR b.content LIKE '%' || tag.content || '%'
      WHERE tag.content LIKE '%${keyword}%' AND tag.content != ''
      GROUP BY tag_name
      HAVING usage_count >= ${minUsageCount}
      ORDER BY usage_count DESC
      LIMIT ${limit}
    `;
  }

  /**
   * 构建按标签查询块的SQL
   */
  private buildBlocksByTagQuery(tagName: string, options: any): string {
    const { 
      limit = 50, 
      offset = 0, 
      includeContent = false,
      sortBy = 'updated',
      sortOrder = 'desc'
    } = options;

    const selectFields = includeContent 
      ? 'b.id, b.content, b.markdown, b.created, b.updated, b.type'
      : 'b.id, b.created, b.updated, b.type';

    return `
      SELECT ${selectFields}
      FROM blocks b
      WHERE b.content LIKE '%#${tagName}%' OR b.markdown LIKE '%#${tagName}%'
      ORDER BY b.${sortBy} ${sortOrder.toUpperCase()}
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  /**
   * 构建标签统计查询SQL
   */
  private buildTagStatisticsQuery(timeRange: string): string {
    let dateFilter = '';
    
    if (timeRange !== 'all') {
      const days = {
        'week': 7,
        'month': 30,
        'year': 365
      }[timeRange] || 30;
      
      dateFilter = `AND b.updated >= datetime('now', '-${days} days')`;
    }

    return `
      SELECT 
        DISTINCT TRIM(tag.content) as tag_name,
        COUNT(*) as usage_count,
        MIN(b.created) as first_used,
        MAX(b.updated) as last_used
      FROM blocks b
      JOIN (
        SELECT id, TRIM(SUBSTR(content, 2)) as content 
        FROM blocks 
        WHERE content LIKE '#%' AND type = 'tag'
      ) tag ON b.id = tag.id OR b.content LIKE '%' || tag.content || '%'
      WHERE tag.content != '' ${dateFilter}
      GROUP BY tag_name
      ORDER BY usage_count DESC
    `;
  }

  /**
   * 验证标签管理请求参数
   */
  private validateManageTagsRequest(request: ManageBlockTagsRequest): void {
    if (!request.blockIDs || !Array.isArray(request.blockIDs) || request.blockIDs.length === 0) {
      throw new Error('块ID数组不能为空');
    }

    if (!request.tags || !Array.isArray(request.tags) || request.tags.length === 0) {
      throw new Error('标签数组不能为空');
    }

    if (!['add', 'remove', 'replace'].includes(request.operation)) {
      throw new Error('操作类型必须是 add、remove 或 replace');
    }

    // 验证标签格式
    for (const tag of request.tags) {
      if (typeof tag !== 'string' || tag.trim().length === 0) {
        throw new Error('标签必须是非空字符串');
      }
      
      if (tag.includes('#')) {
        throw new Error('标签名称不应包含 # 符号');
      }
    }
  }

  /**
   * 处理单个块的标签操作
   */
  private async processBlockTagOperation(
    blockID: string, 
    tags: string[], 
    operation: 'add' | 'remove' | 'replace'
  ): Promise<void> {
    // 获取当前块的内容
    const blockResponse = await this.client.getBlockByID({ id: blockID });
    
    if (blockResponse.code !== 0) {
      throw new Error(`获取块 ${blockID} 失败: ${blockResponse.msg}`);
    }

    const currentContent = blockResponse.data?.markdown || '';
    const currentTags = this.extractTagsFromContent(currentContent);
    
    let newTags: string[];
    
    switch (operation) {
      case 'add':
        newTags = [...new Set([...currentTags, ...tags])];
        break;
      case 'remove':
        newTags = currentTags.filter(tag => !tags.includes(tag));
        break;
      case 'replace':
        newTags = [...tags];
        break;
      default:
        throw new Error(`不支持的操作类型: ${operation}`);
    }

    // 更新块内容
    const newContent = this.updateContentWithTags(currentContent, newTags);
    
    const updateResponse = await this.client.updateBlock(blockID, newContent);

    if (updateResponse.code !== 0) {
      throw new Error(`更新块 ${blockID} 失败: ${updateResponse.msg}`);
    }
  }

  /**
   * 从内容中提取标签
   */
  private extractTagsFromContent(content: string): string[] {
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
   * 更新内容中的标签
   */
  private updateContentWithTags(content: string, tags: string[]): string {
    // 移除现有标签
    let newContent = content.replace(/#[^\s#]+/g, '').trim();
    
    // 添加新标签
    if (tags.length > 0) {
      const tagString = tags.map(tag => `#${tag}`).join(' ');
      newContent = `${newContent}\n\n${tagString}`.trim();
    }

    return newContent;
  }
}

/**
 * SQL服务
 * 提供SQL查询和事务管理功能
 *
 * @author CodeBuddy
 * @since 1.0.0
 */

import { SiyuanClient } from '../siyuanClient';

export interface SqlQueryRequest {
  stmt: string;
}

export interface SqlQueryResponse {
  code: number;
  msg: string;
  data: any[];
}

export interface SqlFlushResponse {
  code: number;
  msg: string;
  data: null;
}

export class SqlService {
  private client: SiyuanClient;

  constructor(client: SiyuanClient) {
    this.client = client;
  }

  /**
   * 执行SQL查询
   *
   * @param stmt - SQL语句
   * @returns {Promise<SqlQueryResponse>} 查询结果
   *
   * @example
   * ```typescript
   * const sqlService = new SqlService(client);
   * const result = await sqlService.query(
   *   "SELECT * FROM blocks WHERE type='d'"
   * );
   * console.log('查询结果:', result.data);
   * ```
   */
  async query(stmt: string): Promise<SqlQueryResponse> {
    return await this.client.request('/api/query/sql', { stmt });
  }

  /**
   * 执行SELECT查询并返回结果
   *
   * @param stmt - SQL语句
   * @returns {Promise<any[]>} 查询结果数组
   */
  async select(stmt: string): Promise<any[]> {
    const response = await this.query(stmt);

    if (response.code !== 0) {
      throw new Error(response.msg || 'SQL查询失败');
    }

    return response.data || [];
  }

  /**
   * 执行SELECT查询并返回单行结果
   *
   * @param stmt - SQL语句
   * @returns {Promise<any | null>} 单行结果或null
   */
  async selectOne(stmt: string): Promise<any | null> {
    const rows = await this.select(stmt);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 查询所有文档
   *
   * @returns {Promise<any[]>} 文档列表
   */
  async getAllDocuments(): Promise<any[]> {
    return await this.select("SELECT * FROM blocks WHERE type='d'");
  }

  /**
   * 查询所有块
   *
   * @returns {Promise<any[]>} 块列表
   */
  async getAllBlocks(): Promise<any[]> {
    return await this.select('SELECT * FROM blocks');
  }

  /**
   * 根据ID查询块
   *
   * @param id - 块ID
   * @returns {Promise<any | null>} 块数据或null
   */
  async getBlockById(id: string): Promise<any | null> {
    return await this.selectOne(`SELECT * FROM blocks WHERE id='${id}'`);
  }

  /**
   * 根据类型查询块
   *
   * @param type - 块类型 (d=document, p=paragraph, h=heading, etc.)
   * @returns {Promise<any[]>} 块列表
   */
  async getBlocksByType(type: string): Promise<any[]> {
    return await this.select(`SELECT * FROM blocks WHERE type='${type}'`);
  }

  /**
   * 执行事务刷新
   *
   * @returns {Promise<SqlFlushResponse>} 刷新结果
   */
  async flush(): Promise<SqlFlushResponse> {
    return await this.client.request('/api/sql/flush');
  }

  /**
   * 批量执行SQL语句
   *
   * @param statements - SQL语句数组
   * @returns {Promise<boolean>} 是否全部成功
   */
  async batchExecute(statements: string[]): Promise<boolean> {
    for (const stmt of statements) {
      try {
        await this.query(stmt);
      } catch (error) {
        console.error('批量SQL执行失败:', stmt, error);
        return false;
      }
    }

    await this.flush();
    return true;
  }

  /**
   * 获取块计数
   *
   * @param type - 可选的块类型过滤
   * @returns {Promise<number>} 块数量
   */
  async getBlockCount(type?: string): Promise<number> {
    const sql = type
      ? `SELECT COUNT(*) as count FROM blocks WHERE type='${type}'`
      : 'SELECT COUNT(*) as count FROM blocks';

    const result = await this.selectOne(sql);
    return result?.count || 0;
  }

  /**
   * 搜索内容
   *
   * @param keyword - 搜索关键词
   * @param limit - 结果限制
   * @returns {Promise<any[]>} 匹配的块列表
   */
  async search(keyword: string, limit = 100): Promise<any[]> {
    const escapedKeyword = keyword.replace(/'/g, "''");
    return await this.select(
      `SELECT * FROM blocks WHERE content LIKE '%${escapedKeyword}%' LIMIT ${limit}`
    );
  }

  /**
   * 获取文档的子块
   *
   * @param docId - 文档ID
   * @returns {Promise<any[]>} 子块列表
   */
  async getChildBlocks(docId: string): Promise<any[]> {
    return await this.select(
      `SELECT * FROM blocks WHERE parent_id='${docId}'`
    );
  }
}

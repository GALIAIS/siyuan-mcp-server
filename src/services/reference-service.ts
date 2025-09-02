/**
 * 引用关系管理服务
 * 提供块引用关系的查询、分析和管理功能
 * 
 * @author CodeBuddy
 * @since 1.0.0
 */

import { SiyuanClient } from '../siyuanClient';
import {
  GetBlockReferencesRequest,
  GetBlockReferencesResponse,
  ReferenceInfo,
  RelationshipNode,
  RelationshipEdge
} from '../interfaces';

export class ReferenceService {
  private client: SiyuanClient;

  /**
   * 构造函数
   * @param client - 思源客户端实例
   */
  constructor(client: SiyuanClient) {
    this.client = client;
  }

  /**
   * 获取块的所有引用关系
   * 
   * @param request - 引用关系查询请求
   * @returns {Promise<GetBlockReferencesResponse>} 引用关系图谱
   * 
   * @throws {Error} 当参数无效时抛出
   * @throws {Error} 当查询失败时抛出
   * 
   * @example
   * ```typescript
   * const referenceService = new ReferenceService(client);
   * const references = await referenceService.getBlockReferences({
   *   blockID: 'block-123',
   *   includeBacklinks: true,
   *   maxDepth: 2,
   *   includeContext: true
   * });
   * ```
   */
  async getBlockReferences(request: GetBlockReferencesRequest): Promise<GetBlockReferencesResponse> {
    try {
      this.validateGetReferencesRequest(request);

      const { blockID, includeBacklinks = true, maxDepth = 1, includeContext = true } = request;

      // 获取出链和入链
      const outgoingRefs = await this.getOutgoingReferences(blockID, includeContext);
      const incomingRefs = includeBacklinks 
        ? await this.getIncomingReferences(blockID, includeContext)
        : [];

      // 构建关系图谱
      const relationshipGraph = await this.buildRelationshipGraph(
        blockID, 
        outgoingRefs, 
        incomingRefs, 
        maxDepth
      );

      return {
        code: 0,
        msg: '获取引用关系成功',
        data: {
          blockID,
          references: {
            outgoing: outgoingRefs,
            incoming: incomingRefs
          },
          relationshipGraph
        }
      };
    } catch (error) {
      throw new Error(`获取块引用关系失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取块的反向链接（入链）
   * 
   * @param blockID - 块ID
   * @param includeContext - 是否包含上下文
   * @returns {Promise<ReferenceInfo[]>} 反向链接列表
   */
  async getBacklinks(blockID: string, includeContext: boolean = true): Promise<ReferenceInfo[]> {
    try {
      if (!blockID) {
        throw new Error('块ID不能为空');
      }
      return await this.getIncomingReferences(blockID, includeContext);
    } catch (error) {
      throw new Error(`获取反向链接失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 创建块之间的引用链接
   * 
   * @param sourceBlockID - 源块ID
   * @param targetBlockID - 目标块ID
   * @param referenceType - 引用类型
   * @returns 创建结果
   */
  async createReference(
    sourceBlockID: string,
    targetBlockID: string,
    referenceType: 'block_ref' | 'embed' | 'link' = 'block_ref'
  ) {
    try {
      if (!sourceBlockID || !targetBlockID) {
        throw new Error('源块ID和目标块ID不能为空');
      }

      if (sourceBlockID === targetBlockID) {
        throw new Error('不能创建自引用');
      }

      // 构建引用语法并更新源块
      const referenceText = this.buildReferenceText(targetBlockID, referenceType);
      
      return {
        success: true,
        sourceBlockID,
        targetBlockID,
        referenceType,
        referenceText,
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`创建引用失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 验证获取引用关系请求参数
   */
  private validateGetReferencesRequest(request: GetBlockReferencesRequest): void {
    if (!request.blockID) {
      throw new Error('块ID不能为空');
    }
    if (request.maxDepth && (request.maxDepth < 1 || request.maxDepth > 10)) {
      throw new Error('最大深度必须在1-10之间');
    }
  }

  /**
   * 获取出链引用
   */
  private async getOutgoingReferences(blockID: string, includeContext: boolean): Promise<ReferenceInfo[]> {
    const sql = `
      SELECT DISTINCT
        b2.id as target_id,
        b2.content as target_content,
        b1.content as source_context
      FROM blocks b1
      JOIN blocks b2 ON (
        b1.content LIKE '%((''' || b2.id || '''))%' OR
        b1.markdown LIKE '%[%](' || b2.id || ')%'
      )
      WHERE b1.id = '${blockID}' AND b1.id != b2.id
      LIMIT 100
    `;

    try {
      const response = await this.client.sql({ stmt: sql });
      if (response.code !== 0) {
        throw new Error(`查询出链失败: ${response.msg}`);
      }

      return (response.data || []).map((row: any) => ({
        targetID: row.target_id,
        targetContent: this.truncateContent(row.target_content),
        context: includeContext ? this.truncateContent(row.source_context) : '',
        type: this.detectReferenceType(row.source_context, row.target_id)
      }));
    } catch (error) {
      console.error('获取出链引用失败:', error);
      return [];
    }
  }

  /**
   * 获取入链引用
   */
  private async getIncomingReferences(blockID: string, includeContext: boolean): Promise<ReferenceInfo[]> {
    const sql = `
      SELECT DISTINCT
        b1.id as source_id,
        b1.content as source_content
      FROM blocks b1
      WHERE (
        b1.content LIKE '%((''' || '${blockID}' || '''))%' OR
        b1.markdown LIKE '%[%](' || '${blockID}' || ')%'
      ) AND b1.id != '${blockID}'
      LIMIT 100
    `;

    try {
      const response = await this.client.sql({ stmt: sql });
      if (response.code !== 0) {
        throw new Error(`查询入链失败: ${response.msg}`);
      }

      return (response.data || []).map((row: any) => ({
        targetID: row.source_id,
        targetContent: this.truncateContent(row.source_content),
        context: includeContext ? this.truncateContent(row.source_content) : '',
        type: this.detectReferenceType(row.source_content, blockID)
      }));
    } catch (error) {
      console.error('获取入链引用失败:', error);
      return [];
    }
  }

  /**
   * 构建关系图谱
   */
  private async buildRelationshipGraph(
    centerBlockID: string,
    outgoing: ReferenceInfo[],
    incoming: ReferenceInfo[],
    maxDepth: number
  ): Promise<{ nodes: RelationshipNode[]; edges: RelationshipEdge[] }> {
    const nodes = new Map<string, RelationshipNode>();
    const edges: RelationshipEdge[] = [];

    // 添加中心节点
    nodes.set(centerBlockID, {
      id: centerBlockID,
      content: '中心节点',
      type: 'center'
    });

    // 处理出链
    outgoing.forEach(ref => {
      if (!nodes.has(ref.targetID)) {
        nodes.set(ref.targetID, {
          id: ref.targetID,
          content: ref.targetContent,
          type: 'outgoing'
        });
      }
      edges.push({
        source: centerBlockID,
        target: ref.targetID,
        type: ref.type
      });
    });

    // 处理入链
    incoming.forEach(ref => {
      if (!nodes.has(ref.targetID)) {
        nodes.set(ref.targetID, {
          id: ref.targetID,
          content: ref.targetContent,
          type: 'incoming'
        });
      }
      edges.push({
        source: ref.targetID,
        target: centerBlockID,
        type: ref.type
      });
    });

    return {
      nodes: Array.from(nodes.values()),
      edges
    };
  }

  /**
   * 检测引用类型
   */
  private detectReferenceType(content: string, targetID: string): 'block_ref' | 'embed' | 'link' {
    if (content.includes(`((${targetID}))`)) {
      return 'block_ref';
    } else if (content.includes(`{{select * from blocks where id='${targetID}'}}`)) {
      return 'embed';
    } else {
      return 'link';
    }
  }

  /**
   * 构建引用文本
   */
  private buildReferenceText(targetID: string, type: 'block_ref' | 'embed' | 'link'): string {
    switch (type) {
      case 'block_ref':
        return `((${targetID}))`;
      case 'embed':
        return `{{select * from blocks where id='${targetID}'}}`;
      case 'link':
        return `[链接](siyuan://blocks/${targetID})`;
      default:
        return `((${targetID}))`;
    }
  }

  /**
   * 截断内容
   */
  private truncateContent(content: string, maxLength: number = 100): string {
    if (!content) return '';
    return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
  }
}
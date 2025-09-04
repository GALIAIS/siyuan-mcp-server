/**
 * 批量操作服务
 * 提供批量创建、更新、删除块的功能
 */

import { SiyuanClient } from '../siyuanClient/index.js';
import logger from '../logger';

export interface BatchCreateBlocksRequest {
  blocks: Array<{
    content: string;
    parentID?: string;
    previousID?: string;
    dataType?: string;
  }>;
  options?: {
    validateContent?: boolean;
    skipDuplicates?: boolean;
    batchSize?: number;
  };
}

export interface BatchUpdateBlocksRequest {
  updates: Array<{
    id: string;
    data: {
      content?: string;
      dataType?: string;
    };
  }>;
  options?: {
    validateContent?: boolean;
    batchSize?: number;
  };
}

export interface BatchCreateBlocksResponse {
  success: Array<{
    id: string;
    blockID: string;
    content: string;
  }>;
  failed: Array<{
    content: string;
    error: string;
  }>;
  total: number;
  successCount: number;
  failedCount: number;
}

export interface BatchUpdateBlocksResponse {
  success: Array<{
    id: string;
    blockID: string;
  }>;
  failed: Array<{
    id: string;
    error: string;
  }>;
  total: number;
  successCount: number;
  failedCount: number;
}

export interface BatchDeleteBlocksResponse {
  success: string[];
  failed: Array<{
    id: string;
    error: string;
  }>;
  total: number;
  successCount: number;
  failedCount: number;
}

/**
 * 批量操作服务类
 */
export class BatchService {
  private client: SiyuanClient;

  /**
   * 构造函数
   * @param client - SiYuan客户端实例
   */
  constructor(client: SiyuanClient) {
    this.client = client;
  }

  /**
   * 批量创建块
   * @param request - 批量创建请求
   * @returns 批量创建结果
   */
  async batchCreateBlocks(request: BatchCreateBlocksRequest): Promise<BatchCreateBlocksResponse> {
    try {
      logger.info(`开始批量创建 ${request.blocks.length} 个块`);

      const results: BatchCreateBlocksResponse = {
        success: [],
        failed: [],
        total: request.blocks.length,
        successCount: 0,
        failedCount: 0
      };

      for (const block of request.blocks) {
        try {
          const response = await this.client.insertBlock({
            data: block.content,
            dataType: block.dataType || 'markdown',
            parentID: block.parentID,
            previousID: block.previousID
          });

          if (response.code === 0) {
            results.success.push({
              id: response.data[0].doOperations[0].id,
              blockID: response.data[0].doOperations[0].id,
              content: block.content
            });
            results.successCount++;
          } else {
            results.failed.push({
              content: block.content,
              error: response.msg || '创建块失败'
            });
            results.failedCount++;
          }
        } catch (error: any) {
          results.failed.push({
            content: block.content,
            error: error.message
          });
          results.failedCount++;
        }
      }

      logger.info(`批量创建完成: 成功 ${results.successCount}, 失败 ${results.failedCount}`);
      return results;

    } catch (error: any) {
      logger.error('批量创建块失败:', error);
      throw error;
    }
  }

  /**
   * 批量更新块
   * @param request - 批量更新请求
   * @returns 批量更新结果
   */
  async batchUpdateBlocks(request: BatchUpdateBlocksRequest): Promise<BatchUpdateBlocksResponse> {
    try {
      logger.info(`开始批量更新 ${request.updates.length} 个块`);

      const results: BatchUpdateBlocksResponse = {
        success: [],
        failed: [],
        total: request.updates.length,
        successCount: 0,
        failedCount: 0
      };

      for (const update of request.updates) {
        try {
          const response = await this.client.updateBlock(update.id, update.data.content || '');

          if (response.code === 0) {
            results.success.push({
              id: update.id,
              blockID: update.id
            });
            results.successCount++;
          } else {
            results.failed.push({
              id: update.id,
              error: response.msg || '更新块失败'
            });
            results.failedCount++;
          }
        } catch (error: any) {
          results.failed.push({
            id: update.id,
            error: error.message
          });
          results.failedCount++;
        }
      }

      logger.info(`批量更新完成: 成功 ${results.successCount}, 失败 ${results.failedCount}`);
      return results;

    } catch (error: any) {
      logger.error('批量更新块失败:', error);
      throw error;
    }
  }

  /**
   * 批量删除块
   * @param blockIDs - 要删除的块ID数组
   * @returns 批量删除结果
   */
  async batchDeleteBlocks(blockIDs: string[]): Promise<BatchDeleteBlocksResponse> {
    try {
      logger.info(`开始批量删除 ${blockIDs.length} 个块`);

      const results: BatchDeleteBlocksResponse = {
        success: [],
        failed: [],
        total: blockIDs.length,
        successCount: 0,
        failedCount: 0
      };

      for (const blockID of blockIDs) {
        try {
          const response = await this.client.deleteBlock(blockID);

          if (response.code === 0) {
            results.success.push(blockID);
            results.successCount++;
          } else {
            results.failed.push({
              id: blockID,
              error: response.msg || '删除块失败'
            });
            results.failedCount++;
          }
        } catch (error: any) {
          results.failed.push({
            id: blockID,
            error: error.message
          });
          results.failedCount++;
        }
      }

      logger.info(`批量删除完成: 成功 ${results.successCount}, 失败 ${results.failedCount}`);
      return results;

    } catch (error: any) {
      logger.error('批量删除块失败:', error);
      throw error;
    }
  }
}

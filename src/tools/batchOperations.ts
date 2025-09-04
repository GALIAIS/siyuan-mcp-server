import { SiyuanClient } from '../siyuanClient';
import logger from '../logger';
import { BatchResult, CreateBlockRequest, UpdateBlockRequest } from '../interfaces/index.js';

// 使用统一的接口定义，避免重复

export interface CreateDocRequest {
  notebook: string;
  path: string;
  title: string;
  content?: string;
}

export class BatchOperations {
  constructor(private siyuanClient: SiyuanClient) {}

  /**
   * 批量创建块
   */
  async batchCreateBlocks(requests: CreateBlockRequest[]): Promise<BatchResult> {
    logger.info(`开始批量创建块，数量: ${requests.length}`);
    const startTime = Date.now();
    
    const results = await Promise.allSettled(
      requests.map((req, index) => 
        this.siyuanClient.blocks.insertBlock(req.content, req.parentID, req.previousID)
          .then(result => ({ index, result }))
      )
    );

    const processed = this.processBatchResults(results, requests);
    
    logger.info({
      duration: Date.now() - startTime,
      total: requests.length,
      successful: processed.summary.successful,
      failed: processed.summary.failed
    }, '批量创建块完成');

    return processed;
  }

  /**
   * 批量更新块
   */
  async batchUpdateBlocks(requests: UpdateBlockRequest[]): Promise<BatchResult> {
    logger.info(`开始批量更新块，数量: ${requests.length}`);
    const startTime = Date.now();
    
    const results = await Promise.allSettled(
      requests.map((req, index) => 
        this.siyuanClient.blocks.updateBlock(req.id, req.content)
          .then(result => ({ index, result }))
      )
    );

    const processed = this.processBatchResults(results, requests);
    
    logger.info({
      duration: Date.now() - startTime,
      total: requests.length,
      successful: processed.summary.successful,
      failed: processed.summary.failed
    }, '批量更新块完成');

    return processed;
  }

  /**
   * 批量删除块
   */
  async batchDeleteBlocks(blockIds: string[]): Promise<BatchResult> {
    logger.info(`开始批量删除块，数量: ${blockIds.length}`);
    const startTime = Date.now();
    
    const results = await Promise.allSettled(
      blockIds.map((id, index) => 
        this.siyuanClient.blocks.deleteBlock(id)
          .then(result => ({ index, result }))
      )
    );

    const processed = this.processBatchResults(results, blockIds);
    
    logger.info({
      duration: Date.now() - startTime,
      total: blockIds.length,
      successful: processed.summary.successful,
      failed: processed.summary.failed
    }, '批量删除块完成');

    return processed;
  }

  /**
   * 批量创建文档
   * 修复标题带.md后缀和内容处理问题
   */
  async batchCreateDocs(requests: CreateDocRequest[]): Promise<BatchResult> {
    logger.info(`开始批量创建文档，数量: ${requests.length}`);
    const startTime = Date.now();
    
    // 预处理请求，修复标题和内容问题
    const processedRequests = requests.map(req => {
      // 移除标题中的.md后缀
      let cleanTitle = req.title;
      if (cleanTitle.endsWith('.md')) {
        cleanTitle = cleanTitle.slice(0, -3);
        logger.debug(`移除.md后缀: ${req.title} -> ${cleanTitle}`);
      }
      
      // 确保内容不为空，如果为空则使用默认内容
      let content = req.content || '';
      if (!content.trim()) {
        content = `# ${cleanTitle}

这是一个新创建的文档。`;
        logger.debug(`为空内容文档添加默认内容: ${cleanTitle}`);
      }
      
      return {
        ...req,
        title: cleanTitle,
        content: content
      };
    });
    
    const results = await Promise.allSettled(
      processedRequests.map((req, index) => 
        this.siyuanClient.documents.createDoc(req.notebook, req.path, req.title, req.content)
          .then(result => ({ index, result }))
      )
    );

    const processed = this.processBatchResults(results, processedRequests);
    
    logger.info({
      duration: Date.now() - startTime,
      total: requests.length,
      successful: processed.summary.successful,
      failed: processed.summary.failed
    }, '批量创建文档完成');

    return processed;
  }

  /**
   * 批量搜索查询
   */
  async batchSearchQueries(queries: string[], limit = 10): Promise<BatchResult> {
    logger.info(`开始批量搜索，查询数量: ${queries.length}`);
    const startTime = Date.now();
    
    const results = await Promise.allSettled(
      queries.map((query, index) => 
        this.siyuanClient.searchNotes(query, limit)
          .then(result => ({ index, result, query }))
      )
    );

    const processed = this.processBatchResults(results, queries);
    
    logger.info({
      duration: Date.now() - startTime,
      total: queries.length,
      successful: processed.summary.successful,
      failed: processed.summary.failed
    }, '批量搜索完成');

    return processed;
  }

  /**
   * 处理批量操作结果
   */
  private processBatchResults<T>(
    results: PromiseSettledResult<{ index: number; result: any; [key: string]: any }>[],
    originalInputs: T[]
  ): BatchResult {
    const success: any[] = [];
    const failed: Array<{ index: number; error: string; input: T }> = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        success.push(result.value);
      } else {
        failed.push({
          index,
          error: result.reason?.message || String(result.reason),
          input: originalInputs[index]
        });
      }
    });

    const total = results.length;
    const successful = success.length;
    const failedCount = failed.length;

    return {
      success,
      failed,
      summary: {
        total,
        successful,
        failed: failedCount,

      }
    };
  }

  /**
   * 分批处理大量数据
   */
  async processBatches<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    batchSize = 5
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      logger.debug(`处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`);
      
      try {
        const batchResults = await processor(batch);
        results.push(...batchResults);
      } catch (error) {
        logger.error({ error, batchIndex: Math.floor(i / batchSize) }, '批次处理失败');
        throw error;
      }
    }
    
    return results;
  }
}

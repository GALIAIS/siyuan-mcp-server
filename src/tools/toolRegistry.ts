/**
 * 工具注册表
 * 管理所有标准化工具的注册、发现和执行
 */

import logger from '../logger.js';
import { 
  StandardTool, 
  StandardToolResponse, 
  ToolRegistry, 
  StandardToolError, 
  ToolErrorType 
} from './standardTypes.js';
import { cacheManager } from '../utils/cache.js';
import { performanceOptimizer } from '../utils/performanceOptimizer.js';

/**
 * 工具注册表实现
 */
export class StandardToolRegistry implements ToolRegistry {
  private tools = new Map<string, StandardTool>();
  private executionStats = new Map<string, {
    totalExecutions: number;
    successCount: number;
    failureCount: number;
    averageExecutionTime: number;
    lastExecuted: Date;
  }>();

  /**
   * 注册工具
   */
  register(tool: StandardTool): void {
    const toolDefinition = tool.getToolDefinition();
    const toolName = toolDefinition.name;

    if (this.tools.has(toolName)) {
      logger.warn(`工具 '${toolName}' 已存在，将被覆盖`);
    }

    this.tools.set(toolName, tool);
    
    // 初始化统计信息
    this.executionStats.set(toolName, {
      totalExecutions: 0,
      successCount: 0,
      failureCount: 0,
      averageExecutionTime: 0,
      lastExecuted: new Date()
    });

    logger.info(`工具 '${toolName}' 注册成功`);
  }

  /**
   * 注销工具
   */
  unregister(toolName: string): void {
    if (this.tools.delete(toolName)) {
      this.executionStats.delete(toolName);
      logger.info(`工具 '${toolName}' 注销成功`);
    } else {
      logger.warn(`工具 '${toolName}' 不存在，无法注销`);
    }
  }

  /**
   * 获取工具
   */
  get(toolName: string): StandardTool | undefined {
    return this.tools.get(toolName);
  }

  /**
   * 列出所有工具
   */
  list(): StandardTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 获取所有工具定义（MCP格式）
   */
  getAllToolDefinitions() {
    return Array.from(this.tools.values()).map(tool => tool.getToolDefinition());
  }

  /**
   * 执行工具
   */
  async execute(toolName: string, parameters: Record<string, any>): Promise<StandardToolResponse> {
    const startTime = Date.now();
    
    try {
      // 检查工具是否存在
      const tool = this.tools.get(toolName);
      if (!tool) {
        throw new StandardToolError(
          ToolErrorType.RESOURCE_NOT_FOUND,
          `工具 '${toolName}' 不存在`,
          'TOOL_NOT_FOUND',
          { toolName, availableTools: Array.from(this.tools.keys()) }
        );
      }

      // 记录执行开始
      logger.info({
        toolName,
        parameters,
        requestId: `${toolName}_${Date.now()}`
      }, '开始执行工具');

      // 使用性能优化器执行工具
      const result = await performanceOptimizer.optimizeOperation(async () => {
        return await tool.executeWithStandardization(parameters);
      });

      // 更新统计信息
      this.updateExecutionStats(toolName, Date.now() - startTime, true);

      // 记录执行成功
      logger.info({
        toolName,
        success: result.success,
        executionTime: result.executionTime,
        message: result.message
      }, '工具执行完成');

      return result;

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      // 更新统计信息
      this.updateExecutionStats(toolName, executionTime, false);

      // 处理标准化错误
      if (error instanceof StandardToolError) {
        logger.error({
          toolName,
          errorType: error.type,
          errorCode: error.code,
          message: error.message,
          details: error.details
        }, '工具执行失败');

        return error.toStandardResponse(toolName, executionTime);
      }

      // 处理其他错误
      logger.error({
        toolName,
        error: error.message,
        stack: error.stack
      }, '工具执行发生未知错误');

      const standardError = new StandardToolError(
        ToolErrorType.INTERNAL_ERROR,
        error.message || '工具执行失败',
        'EXECUTION_FAILED',
        { originalError: error.toString() }
      );

      return standardError.toStandardResponse(toolName, executionTime);
    }
  }

  /**
   * 批量执行工具
   */
  async executeBatch(requests: Array<{ toolName: string; parameters: Record<string, any> }>): Promise<StandardToolResponse[]> {
    const results: StandardToolResponse[] = [];
    
    // 使用并发控制执行批量请求
    const batchSize = 3; // 限制并发数
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchPromises = batch.map(request => 
        this.execute(request.toolName, request.parameters)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * 获取工具执行统计
   */
  getExecutionStats(toolName?: string) {
    if (toolName) {
      return this.executionStats.get(toolName);
    }
    
    const allStats: Record<string, any> = {};
    for (const [name, stats] of this.executionStats.entries()) {
      allStats[name] = { ...stats };
    }
    return allStats;
  }

  /**
   * 获取工具健康状态
   */
  getHealthStatus() {
    const totalTools = this.tools.size;
    let totalExecutions = 0;
    let totalSuccesses = 0;
    let totalFailures = 0;

    for (const stats of this.executionStats.values()) {
      totalExecutions += stats.totalExecutions;
      totalSuccesses += stats.successCount;
      totalFailures += stats.failureCount;
    }

    const successRate = totalExecutions > 0 ? (totalSuccesses / totalExecutions) * 100 : 0;

    return {
      totalTools,
      totalExecutions,
      totalSuccesses,
      totalFailures,
      successRate: Math.round(successRate * 100) / 100,
      registeredTools: Array.from(this.tools.keys()),
      memoryUsage: performanceOptimizer.getMemoryUsage(),
      cacheStats: cacheManager.getAllStats()
    };
  }

  /**
   * 更新执行统计信息
   */
  private updateExecutionStats(toolName: string, executionTime: number, success: boolean): void {
    const stats = this.executionStats.get(toolName);
    if (!stats) return;

    stats.totalExecutions++;
    stats.lastExecuted = new Date();
    
    if (success) {
      stats.successCount++;
    } else {
      stats.failureCount++;
    }

    // 更新平均执行时间
    const totalTime = stats.averageExecutionTime * (stats.totalExecutions - 1) + executionTime;
    stats.averageExecutionTime = Math.round(totalTime / stats.totalExecutions);
  }

  /**
   * 清理统计信息
   */
  clearStats(): void {
    for (const stats of this.executionStats.values()) {
      stats.totalExecutions = 0;
      stats.successCount = 0;
      stats.failureCount = 0;
      stats.averageExecutionTime = 0;
    }
    logger.info('工具执行统计信息已清理');
  }

  /**
   * 销毁注册表
   */
  destroy(): void {
    this.tools.clear();
    this.executionStats.clear();
    logger.info('工具注册表已销毁');
  }
}

// 导出全局工具注册表实例
export const toolRegistry = new StandardToolRegistry();

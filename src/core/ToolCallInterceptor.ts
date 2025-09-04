/**
 * 工具调用拦截器
 * 负责拦截和验证所有MCP工具调用，确保遵循安全规则和依赖关系
 */

import { ToolPriorityManager, ToolCallRecord } from './ToolPriorityManager';
import logger from '../logger';

/**
 * 工具调用请求接口
 */
export interface ToolCallRequest {
  toolName: string;
  parameters: any;
  timestamp?: number;
  requestId?: string;
}

/**
 * 工具调用拦截结果接口
 */
export interface InterceptResult {
  allowed: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  suggestedOrder?: string[];
  modifiedParameters?: any;
}

/**
 * 批量调用验证结果接口
 */
export interface BatchValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  reorderedCalls?: ToolCallRequest[];
  conflictingCalls?: ToolCallRequest[];
}

/**
 * 工具调用拦截器类
 */
export class ToolCallInterceptor {
  private priorityManager: ToolPriorityManager;
  private blockedCalls: ToolCallRequest[] = [];
  private allowedCalls: ToolCallRequest[] = [];

  constructor(priorityManager?: ToolPriorityManager) {
    this.priorityManager = priorityManager || new ToolPriorityManager();
  }

  /**
   * 拦截工具调用
   */
  async interceptToolCall(request: ToolCallRequest): Promise<InterceptResult> {
    const { toolName, parameters } = request;
    
    logger.info(`拦截工具调用: ${toolName}`, { parameters });

    // 验证工具调用
    const validation = this.priorityManager.validateToolCall(toolName, parameters);
    
    const result: InterceptResult = {
      allowed: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      suggestions: []
    };

    // 如果验证失败，提供修复建议
    if (!validation.valid) {
      this.blockedCalls.push(request);
      
      // 生成建议
      if (validation.requiredPrerequisites.length > 0) {
        result.suggestions.push(`请先调用: ${validation.requiredPrerequisites.join(', ')}`);
        result.suggestedOrder = this.priorityManager.getSuggestedCallOrder(toolName);
      }

      // 参数修复建议
      if (toolName === 'createDoc') {
        if (!parameters?.notebook) {
          result.suggestions.push('请提供有效的笔记本ID');
        }
        if (!parameters?.title) {
          result.suggestions.push('请提供有效的文档标题');
        }
      }

      logger.warn(`工具调用被拦截: ${toolName}`, {
        errors: result.errors,
        suggestions: result.suggestions
      });
    } else {
      this.allowedCalls.push(request);
      logger.info(`工具调用通过验证: ${toolName}`);
    }

    return result;
  }

  /**
   * 验证批量调用
   */
  async validateBatchCalls(calls: ToolCallRequest[]): Promise<BatchValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const reorderedCalls: ToolCallRequest[] = [];

    // 按优先级对调用进行排序
    const callsWithPriority = calls.map(call => ({
      ...call,
      priority: this.priorityManager.getToolPriority(call.toolName)
    }));

    // 按优先级排序（数字越小优先级越高）
    callsWithPriority.sort((a, b) => a.priority - b.priority);

    // 验证每个调用的依赖关系
    for (const call of callsWithPriority) {
      const suggestedOrder = this.priorityManager.getSuggestedCallOrder(call.toolName);
      
      // 确保依赖的工具在当前调用之前
      for (const requiredTool of suggestedOrder.slice(0, -1)) {
        const hasRequiredTool = reorderedCalls.some(c => c.toolName === requiredTool);
        if (!hasRequiredTool) {
          // 查找是否在原始调用列表中
          const requiredCall = calls.find(c => c.toolName === requiredTool);
          if (requiredCall && !reorderedCalls.includes(requiredCall)) {
            reorderedCalls.push(requiredCall);
          } else if (!requiredCall) {
            errors.push(`缺少必需的工具调用: ${requiredTool} (为了执行 ${call.toolName})`);
          }
        }
      }

      if (!reorderedCalls.includes(call)) {
        reorderedCalls.push(call);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      reorderedCalls: errors.length === 0 ? reorderedCalls : undefined
    };
  }

  /**
   * 获取被拦截的调用记录
   */
  getBlockedCalls(): ToolCallRequest[] {
    return [...this.blockedCalls];
  }

  /**
   * 获取允许的调用记录
   */
  getAllowedCalls(): ToolCallRequest[] {
    return [...this.allowedCalls];
  }

  /**
   * 清理调用历史
   */
  clearHistory(): void {
    this.blockedCalls = [];
    this.allowedCalls = [];
    logger.info('已清理拦截器调用历史');
  }

  /**
   * 执行安全的工具调用
   */
  async safeToolCall(request: ToolCallRequest, executor: (req: ToolCallRequest) => Promise<any>): Promise<{
    success: boolean;
    result?: any;
    error?: string;
    interceptResult: InterceptResult;
  }> {
    const interceptResult = await this.interceptToolCall(request);

    if (!interceptResult.allowed) {
      return {
        success: false,
        error: `工具调用被拦截: ${interceptResult.errors.join(', ')}`,
        interceptResult
      };
    }

    try {
      // 使用修改后的参数（如果有）
      const finalRequest = {
        ...request,
        parameters: interceptResult.modifiedParameters || request.parameters
      };

      const result = await executor(finalRequest);

      // 记录成功的调用
      this.priorityManager.recordToolCall({
        toolName: request.toolName,
        timestamp: Date.now(),
        parameters: finalRequest.parameters,
        result,
        success: true
      });

      return {
        success: true,
        result,
        interceptResult
      };
    } catch (error: any) {
      // 记录失败的调用
      this.priorityManager.recordToolCall({
        toolName: request.toolName,
        timestamp: Date.now(),
        parameters: request.parameters,
        success: false,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        interceptResult
      };
    }
  }

  /**
   * 生成安全调用指南
   */
  generateSecurityGuide(): string {
    let guide = '# MCP 工具调用安全指南\n\n';
    
    guide += '## 核心安全原则\n';
    guide += '1. **严格依赖验证** - 所有工具调用必须满足依赖关系\n';
    guide += '2. **参数完整性检查** - 确保所有必需参数都已提供且有效\n';
    guide += '3. **操作顺序控制** - 按照正确的优先级顺序执行工具调用\n';
    guide += '4. **错误处理和恢复** - 提供清晰的错误信息和修复建议\n\n';

    guide += '## 常见拦截场景\n\n';
    guide += '### 文档创建安全检查\n';
    guide += '- **问题**: 直接调用 `createDoc` 而未验证笔记本\n';
    guide += '- **解决方案**: 先调用 `listNotebooks` 和 `openNotebook`\n';
    guide += '- **正确顺序**: `listNotebooks` → `openNotebook` → `createDoc`\n\n';

    guide += '### 参数验证失败\n';
    guide += '- **问题**: 提供空的或无效的参数\n';
    guide += '- **解决方案**: 确保所有必需参数都有有效值\n';
    guide += '- **示例**: `notebook` 不能为空，`title` 必须是非空字符串\n\n';

    guide += this.priorityManager.generateCallGuide();

    return guide;
  }

  /**
   * 获取拦截统计信息
   */
  getInterceptStatistics(): {
    totalIntercepted: number;
    blockedCalls: number;
    allowedCalls: number;
    mostBlockedTool: string | null;
    commonErrors: string[];
  } {
    const toolBlockCount = new Map<string, number>();
    const errorCount = new Map<string, number>();

    for (const call of this.blockedCalls) {
      const count = toolBlockCount.get(call.toolName) || 0;
      toolBlockCount.set(call.toolName, count + 1);
    }

    // 找出最常被拦截的工具
    let mostBlockedTool: string | null = null;
    let maxBlocks = 0;
    for (const [tool, count] of toolBlockCount) {
      if (count > maxBlocks) {
        maxBlocks = count;
        mostBlockedTool = tool;
      }
    }

    // 统计常见错误（这里简化处理）
    const commonErrors = [
      '缺少依赖工具的调用记录',
      '参数验证失败',
      '违反安全规则'
    ];

    return {
      totalIntercepted: this.blockedCalls.length + this.allowedCalls.length,
      blockedCalls: this.blockedCalls.length,
      allowedCalls: this.allowedCalls.length,
      mostBlockedTool,
      commonErrors
    };
  }
}

/**
 * 全局工具调用拦截器实例
 */
export const toolCallInterceptor = new ToolCallInterceptor();

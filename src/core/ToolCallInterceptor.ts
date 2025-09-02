/**
 * 工具调用拦截器
 * 在AI调用MCP工具时进行拦截，确保遵循正确的调用顺序和依赖关系
 */

import { ToolPriorityManager } from './ToolPriorityManager.js';
import logger from '../logger.js';

export interface ToolCallRequest {
  toolName: string;
  parameters: any;
  requestId?: string;
  timestamp?: number;
}

export interface ToolCallResponse {
  success: boolean;
  data?: any;
  error?: string;
  suggestions?: string[];
  executionTime: number;
  validationResult?: {
    valid: boolean;
    error?: string;
    missingDependencies?: string[];
  };
}

/**
 * 工具调用拦截器类
 * 负责拦截、验证和优化工具调用流程
 */
export class ToolCallInterceptor {
  private priorityManager: ToolPriorityManager;
  private callHistory: Map<string, ToolCallRequest[]> = new Map();
  private maxHistorySize = 100;

  constructor() {
    this.priorityManager = ToolPriorityManager.getInstance();
  }

  /**
   * 拦截工具调用
   * @param request 工具调用请求
   * @returns 拦截结果和建议
   */
  async interceptToolCall(request: ToolCallRequest): Promise<{
    shouldProceed: boolean;
    response?: ToolCallResponse;
    suggestions?: string[];
  }> {
    const startTime = Date.now();
    const { toolName, parameters } = request;

    try {
      logger.info(`拦截工具调用: ${toolName}`, { parameters });

      // 1. 验证工具调用的前置条件
      const validationResult = await this.priorityManager.validateToolCall(toolName, parameters);
      
      if (!validationResult.valid) {
        // 生成调用建议
        const suggestion = this.priorityManager.generateCallSuggestion(toolName);
        
        const response: ToolCallResponse = {
          success: false,
          error: validationResult.error,
          suggestions: [
            `❌ 工具调用被拦截: ${validationResult.error}`,
            '',
            '🔧 建议的调用顺序:',
            suggestion.explanation,
            '',
            '💡 请按照建议的顺序调用工具以确保操作成功。'
          ],
          executionTime: Date.now() - startTime,
          validationResult
        };

        return {
          shouldProceed: false,
          response,
          suggestions: response.suggestions
        };
      }

      // 2. 特殊处理文档创建工具
      if (toolName === 'create_document' || toolName === 'siyuan-local/create_document') {
        const notebookValidation = await this.validateNotebookForDocumentCreation(parameters);
        if (!notebookValidation.valid) {
          const response: ToolCallResponse = {
            success: false,
            error: notebookValidation.error,
            suggestions: notebookValidation.suggestions,
            executionTime: Date.now() - startTime,
            validationResult: {
              valid: false,
              error: notebookValidation.error
            }
          };

          return {
            shouldProceed: false,
            response,
            suggestions: notebookValidation.suggestions
          };
        }
      }

      // 3. 记录调用历史
      this.recordToolCall(request);

      // 4. 允许继续执行
      return {
        shouldProceed: true
      };

    } catch (error: any) {
      logger.error(`工具调用拦截失败: ${toolName}`, { error: error.message });
      
      const response: ToolCallResponse = {
        success: false,
        error: `拦截器内部错误: ${error.message}`,
        executionTime: Date.now() - startTime
      };

      return {
        shouldProceed: false,
        response
      };
    }
  }

  /**
   * 验证文档创建的笔记本前置条件
   * @param parameters 工具参数
   * @returns 验证结果
   */
  private async validateNotebookForDocumentCreation(parameters: any): Promise<{
    valid: boolean;
    error?: string;
    suggestions?: string[];
  }> {
    const { notebook } = parameters;

    if (!notebook) {
      return {
        valid: false,
        error: '缺少必需的笔记本ID参数',
        suggestions: [
          '❌ 创建文档失败: 缺少笔记本ID',
          '',
          '🔧 正确的调用流程:',
          '1. 首先调用 list_notebooks 获取可用的笔记本',
          '2. 选择目标笔记本ID',
          '3. 使用笔记本ID调用 create_document',
          '',
          '💡 示例:',
          '```',
          '// 1. 获取笔记本列表',
          'const notebooks = await listNotebooks();',
          '',
          '// 2. 选择或创建笔记本',
          'const targetNotebook = notebooks.find(nb => nb.name === "目标笔记本");',
          'if (!targetNotebook) {',
          '  const newNotebook = await createNotebook({ name: "目标笔记本" });',
          '  targetNotebook = newNotebook;',
          '}',
          '',
          '// 3. 创建文档',
          'await createDocument({',
          '  notebook: targetNotebook.id,',
          '  title: "文档标题",',
          '  content: "文档内容"',
          '});',
          '```'
        ]
      };
    }

    // 检查是否已经调用过 list_notebooks
    const listNotebooksRecord = this.priorityManager.getToolCallRecord('list_notebooks');
    if (!listNotebooksRecord) {
      return {
        valid: false,
        error: '必须先调用 list_notebooks 获取笔记本列表',
        suggestions: [
          '❌ 创建文档被阻止: 未验证笔记本存在性',
          '',
          '🔧 必需的前置步骤:',
          '1. 调用 list_notebooks 获取所有笔记本',
          '2. 验证目标笔记本存在',
          '3. 然后创建文档',
          '',
          '⚠️  安全提示:',
          '为了防止在不存在的笔记本中创建文档，',
          '系统要求必须先验证笔记本的存在性。'
        ]
      };
    }

    return { valid: true };
  }

  /**
   * 记录工具调用历史
   * @param request 工具调用请求
   */
  private recordToolCall(request: ToolCallRequest): void {
    const { toolName } = request;
    
    if (!this.callHistory.has(toolName)) {
      this.callHistory.set(toolName, []);
    }

    const history = this.callHistory.get(toolName)!;
    history.push({
      ...request,
      timestamp: Date.now()
    });

    // 限制历史记录大小
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }

    // 同时记录到优先级管理器
    this.priorityManager.recordToolCall(toolName, { success: true, timestamp: Date.now() });
  }

  /**
   * 获取工具调用历史
   * @param toolName 工具名称（可选）
   * @returns 调用历史
   */
  getCallHistory(toolName?: string): Map<string, ToolCallRequest[]> | ToolCallRequest[] {
    if (toolName) {
      return this.callHistory.get(toolName) || [];
    }
    return this.callHistory;
  }

  /**
   * 清除调用历史
   */
  clearHistory(): void {
    this.callHistory.clear();
    this.priorityManager.clearCache();
    logger.info('工具调用历史已清除');
  }

  /**
   * 生成调用流程建议
   * @param targetTool 目标工具
   * @returns 调用建议
   */
  generateFlowSuggestion(targetTool: string): string[] {
    const suggestion = this.priorityManager.generateCallSuggestion(targetTool);
    
    const suggestions = [
      `🎯 目标工具: ${targetTool}`,
      '',
      '📋 推荐调用流程:',
      suggestion.explanation,
      '',
      '⚡ 快速开始:',
      '1. 按照上述顺序逐一调用工具',
      '2. 确保每个工具调用成功后再进行下一步',
      '3. 遇到错误时查看错误信息和建议',
      '',
      '🔍 调用状态检查:',
      '- ✅ 已完成的工具调用会被记录',
      '- ❌ 失败的调用需要重新执行',
      '- 🔄 系统会自动验证依赖关系'
    ];

    return suggestions;
  }

  /**
   * 获取拦截器统计信息
   */
  getStats(): {
    totalInterceptions: number;
    blockedCalls: number;
    allowedCalls: number;
    toolCallCounts: Record<string, number>;
  } {
    let totalInterceptions = 0;
    let blockedCalls = 0;
    let allowedCalls = 0;
    const toolCallCounts: Record<string, number> = {};

    for (const [toolName, history] of this.callHistory.entries()) {
      const count = history.length;
      totalInterceptions += count;
      allowedCalls += count; // 记录的都是允许的调用
      toolCallCounts[toolName] = count;
    }

    return {
      totalInterceptions,
      blockedCalls,
      allowedCalls,
      toolCallCounts
    };
  }
}

// 导出全局拦截器实例
export const toolCallInterceptor = new ToolCallInterceptor();
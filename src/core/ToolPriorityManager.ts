/**
 * 工具调用优先级管理器
 * 确保AI调用MCP工具时遵循正确的顺序和依赖关系
 */

import logger from '../logger';

/**
 * 工具优先级枚举
 */
export enum ToolPriority {
  CRITICAL = 1,    // 关键操作：笔记本验证、权限检查
  HIGH = 2,        // 高优先级：文档创建前置条件
  MEDIUM = 3,      // 中等优先级：常规文档操作
  LOW = 4,         // 低优先级：辅助功能
  BACKGROUND = 5   // 后台操作：清理、统计等
}

/**
 * 工具依赖关系接口
 */
export interface ToolDependency {
  toolName: string;
  requiredTools: string[];
  priority: ToolPriority;
  description: string;
  validationRules?: string[];
}

/**
 * 工具调用记录接口
 */
export interface ToolCallRecord {
  toolName: string;
  timestamp: number;
  parameters: any;
  result?: any;
  success: boolean;
  error?: string;
}

/**
 * 工具优先级管理器类
 */
export class ToolPriorityManager {
  private toolDependencies: Map<string, ToolDependency> = new Map();
  private callHistory: ToolCallRecord[] = [];
  private maxHistorySize: number = 100;

  constructor() {
    this.initializeToolDependencies();
  }

  /**
   * 初始化工具依赖关系
   */
  private initializeToolDependencies(): void {
    // 笔记本相关工具
    this.registerTool({
      toolName: 'listNotebooks',
      requiredTools: [],
      priority: ToolPriority.CRITICAL,
      description: '获取笔记本列表 - 所有文档操作的前置条件',
      validationRules: ['必须首先验证笔记本存在性']
    });

    this.registerTool({
      toolName: 'openNotebook',
      requiredTools: ['listNotebooks'],
      priority: ToolPriority.CRITICAL,
      description: '打开笔记本 - 文档操作前必须确保笔记本已打开',
      validationRules: ['笔记本必须存在', '笔记本不能处于关闭状态']
    });

    // 文档创建相关工具
    this.registerTool({
      toolName: 'createDoc',
      requiredTools: ['listNotebooks', 'openNotebook'],
      priority: ToolPriority.HIGH,
      description: '创建文档 - 必须在验证笔记本后执行',
      validationRules: [
        '禁止直接创建文档',
        '必须先验证目标笔记本存在',
        '必须确保笔记本已打开',
        '文档标题不能为空'
      ]
    });

    // 文档查询工具
    this.registerTool({
      toolName: 'getDoc',
      requiredTools: [],
      priority: ToolPriority.MEDIUM,
      description: '获取文档内容',
      validationRules: ['文档ID必须有效']
    });

    this.registerTool({
      toolName: 'searchDocs',
      requiredTools: [],
      priority: ToolPriority.MEDIUM,
      description: '搜索文档',
      validationRules: ['搜索关键词不能为空']
    });

    // 文档修改工具
    this.registerTool({
      toolName: 'updateDoc',
      requiredTools: ['getDoc'],
      priority: ToolPriority.MEDIUM,
      description: '更新文档内容 - 建议先获取当前内容',
      validationRules: ['文档必须存在', '内容不能为空']
    });

    this.registerTool({
      toolName: 'deleteDoc',
      requiredTools: ['getDoc'],
      priority: ToolPriority.HIGH,
      description: '删除文档 - 高风险操作，需要确认',
      validationRules: ['文档必须存在', '需要二次确认']
    });

    // 批量操作工具
    this.registerTool({
      toolName: 'batchReadAllDocuments',
      requiredTools: ['listNotebooks'],
      priority: ToolPriority.LOW,
      description: '批量读取所有文档 - 资源密集型操作',
      validationRules: ['笔记本必须存在', '建议在低峰时段执行']
    });

    logger.info(`已注册 ${this.toolDependencies.size} 个工具的依赖关系`);
  }

  /**
   * 注册工具依赖关系
   */
  registerTool(dependency: ToolDependency): void {
    this.toolDependencies.set(dependency.toolName, dependency);
    logger.debug(`注册工具依赖: ${dependency.toolName}`);
  }

  /**
   * 验证工具调用是否符合依赖关系
   */
  validateToolCall(toolName: string, parameters?: any): {
    valid: boolean;
    errors: string[];
    warnings: string[];
    requiredPrerequisites: string[];
  } {
    const dependency = this.toolDependencies.get(toolName);
    const errors: string[] = [];
    const warnings: string[] = [];
    const requiredPrerequisites: string[] = [];

    // 检查工具是否已注册
    if (!dependency) {
      warnings.push(`工具 ${toolName} 未注册依赖关系，建议添加`);
      return {
        valid: true, // 未注册的工具允许调用，但给出警告
        errors,
        warnings,
        requiredPrerequisites
      };
    }

    // 检查必需的前置工具是否已调用
    for (const requiredTool of dependency.requiredTools) {
      const hasBeenCalled = this.callHistory.some(
        record => record.toolName === requiredTool && record.success
      );

      if (!hasBeenCalled) {
        errors.push(`缺少依赖工具的调用记录: ${requiredTool}`);
        requiredPrerequisites.push(requiredTool);
      }
    }

    // 特殊验证规则
    if (toolName === 'createDoc') {
      // 验证笔记本参数
      if (!parameters?.notebook) {
        errors.push('参数验证失败: 缺少笔记本ID');
      }

      // 验证标题参数
      if (!parameters?.title || typeof parameters.title !== 'string' || parameters.title.trim().length === 0) {
        errors.push('参数验证失败: 文档标题不能为空');
      }

      // 检查是否尝试直接创建文档
      const hasNotebookValidation = this.callHistory.some(
        record => record.toolName === 'listNotebooks' && record.success
      );

      if (!hasNotebookValidation) {
        errors.push('违反安全规则: 禁止直接创建文档，必须先验证笔记本');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      requiredPrerequisites
    };
  }

  /**
   * 记录工具调用
   */
  recordToolCall(record: ToolCallRecord): void {
    this.callHistory.push(record);

    // 限制历史记录大小
    if (this.callHistory.length > this.maxHistorySize) {
      this.callHistory = this.callHistory.slice(-this.maxHistorySize);
    }

    logger.debug(`记录工具调用: ${record.toolName}, 成功: ${record.success}`);
  }

  /**
   * 获取工具调用建议顺序
   */
  getSuggestedCallOrder(targetTool: string): string[] {
    const dependency = this.toolDependencies.get(targetTool);
    if (!dependency) {
      return [targetTool];
    }

    const order: string[] = [];
    const visited = new Set<string>();

    const buildOrder = (toolName: string) => {
      if (visited.has(toolName)) {
        return;
      }

      visited.add(toolName);
      const toolDep = this.toolDependencies.get(toolName);
      
      if (toolDep) {
        // 先添加依赖工具
        for (const requiredTool of toolDep.requiredTools) {
          buildOrder(requiredTool);
        }
      }

      // 再添加当前工具
      if (!order.includes(toolName)) {
        order.push(toolName);
      }
    };

    buildOrder(targetTool);
    return order;
  }

  /**
   * 获取工具优先级
   */
  getToolPriority(toolName: string): ToolPriority {
    const dependency = this.toolDependencies.get(toolName);
    return dependency?.priority || ToolPriority.MEDIUM;
  }

  /**
   * 获取工具描述和验证规则
   */
  getToolInfo(toolName: string): {
    description: string;
    validationRules: string[];
    requiredTools: string[];
    priority: ToolPriority;
  } | null {
    const dependency = this.toolDependencies.get(toolName);
    if (!dependency) {
      return null;
    }

    return {
      description: dependency.description,
      validationRules: dependency.validationRules || [],
      requiredTools: dependency.requiredTools,
      priority: dependency.priority
    };
  }

  /**
   * 清理调用历史
   */
  clearHistory(): void {
    this.callHistory = [];
    logger.info('已清理工具调用历史');
  }

  /**
   * 获取调用统计
   */
  getCallStatistics(): {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    toolUsageCount: Map<string, number>;
    recentCalls: ToolCallRecord[];
  } {
    const toolUsageCount = new Map<string, number>();
    let successfulCalls = 0;
    let failedCalls = 0;

    for (const record of this.callHistory) {
      const currentCount = toolUsageCount.get(record.toolName) || 0;
      toolUsageCount.set(record.toolName, currentCount + 1);

      if (record.success) {
        successfulCalls++;
      } else {
        failedCalls++;
      }
    }

    return {
      totalCalls: this.callHistory.length,
      successfulCalls,
      failedCalls,
      toolUsageCount,
      recentCalls: this.callHistory.slice(-10) // 最近10次调用
    };
  }

  /**
   * 生成工具调用指南
   */
  generateCallGuide(): string {
    let guide = '# SiYuan MCP 工具调用指南\n\n';
    guide += '## 重要安全规则\n';
    guide += '1. **禁止直接创建文档** - 必须先验证笔记本存在性\n';
    guide += '2. **严格遵循调用顺序** - 按照依赖关系执行工具调用\n';
    guide += '3. **参数验证** - 确保所有必需参数都已提供\n\n';

    guide += '## 工具优先级和依赖关系\n\n';

    // 按优先级分组
    const toolsByPriority = new Map<ToolPriority, ToolDependency[]>();
    for (const [_, dependency] of this.toolDependencies) {
      const tools = toolsByPriority.get(dependency.priority) || [];
      tools.push(dependency);
      toolsByPriority.set(dependency.priority, tools);
    }

    for (const [priority, tools] of toolsByPriority) {
      guide += `### ${this.getPriorityName(priority)} (优先级 ${priority})\n\n`;
      
      for (const tool of tools) {
        guide += `**${tool.toolName}**\n`;
        guide += `- 描述: ${tool.description}\n`;
        
        if (tool.requiredTools.length > 0) {
          guide += `- 依赖工具: ${tool.requiredTools.join(', ')}\n`;
        }
        
        if (tool.validationRules && tool.validationRules.length > 0) {
          guide += `- 验证规则:\n`;
          for (const rule of tool.validationRules) {
            guide += `  - ${rule}\n`;
          }
        }
        guide += '\n';
      }
    }

    guide += '## 推荐调用流程\n\n';
    guide += '### 创建文档的正确流程\n';
    guide += '1. `listNotebooks` - 获取并验证笔记本列表\n';
    guide += '2. `openNotebook` - 确保目标笔记本已打开\n';
    guide += '3. `createDoc` - 在验证后的笔记本中创建文档\n\n';

    guide += '### 修改文档的推荐流程\n';
    guide += '1. `getDoc` - 获取当前文档内容\n';
    guide += '2. `updateDoc` - 更新文档内容\n\n';

    return guide;
  }

  /**
   * 获取优先级名称
   */
  private getPriorityName(priority: ToolPriority): string {
    switch (priority) {
      case ToolPriority.CRITICAL: return '关键操作';
      case ToolPriority.HIGH: return '高优先级';
      case ToolPriority.MEDIUM: return '中等优先级';
      case ToolPriority.LOW: return '低优先级';
      case ToolPriority.BACKGROUND: return '后台操作';
      default: return '未知优先级';
    }
  }
}

/**
 * 全局工具优先级管理器实例
 */
export const toolPriorityManager = new ToolPriorityManager();

/**
 * 便捷函数：验证工具调用
 */
export function validateToolCall(toolName: string, parameters?: any) {
  return toolPriorityManager.validateToolCall(toolName, parameters);
}

/**
 * 便捷函数：记录工具调用
 */
export function recordToolCall(record: ToolCallRecord) {
  return toolPriorityManager.recordToolCall(record);
}

/**
 * 便捷函数：获取建议调用顺序
 */
export function getSuggestedCallOrder(targetTool: string): string[] {
  return toolPriorityManager.getSuggestedCallOrder(targetTool);
}
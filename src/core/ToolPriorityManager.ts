/**
 * 工具调用优先级管理器
 * 负责管理工具函数的调用顺序、依赖关系和验证逻辑
 */

export interface ToolDependency {
  /** 工具名称 */
  name: string;
  /** 优先级等级 (1-4, 数字越小优先级越高) */
  level: number;
  /** 依赖的工具列表 */
  dependencies: string[];
  /** 是否需要前置验证 */
  requiresValidation: boolean;
  /** 验证函数 */
  validator?: (params: any) => Promise<boolean>;
}

/**
 * 工具优先级配置
 * 定义了所有工具的调用优先级和依赖关系
 */
export const TOOL_PRIORITIES: Record<string, ToolDependency> = {
  // Level 1: 基础查询工具 (无依赖)
  list_notebooks: {
    name: 'list_notebooks',
    level: 1,
    dependencies: [],
    requiresValidation: false,
  },
  
  search_blocks: {
    name: 'search_blocks',
    level: 1,
    dependencies: [],
    requiresValidation: false,
  },
  
  get_block_info: {
    name: 'get_block_info',
    level: 1,
    dependencies: [],
    requiresValidation: true,
    validator: async (params) => {
      return params.blockId && typeof params.blockId === 'string';
    },
  },
  
  // Level 2: 笔记本操作工具
  create_notebook: {
    name: 'create_notebook',
    level: 2,
    dependencies: ['list_notebooks'],
    requiresValidation: true,
    validator: async (params) => {
      return params.name && typeof params.name === 'string' && params.name.trim().length > 0;
    },
  },
  
  get_notebook_info: {
    name: 'get_notebook_info',
    level: 2,
    dependencies: ['list_notebooks'],
    requiresValidation: true,
    validator: async (params) => {
      return params.notebookId && typeof params.notebookId === 'string';
    },
  },
  
  list_documents: {
    name: 'list_documents',
    level: 2,
    dependencies: ['list_notebooks'],
    requiresValidation: true,
    validator: async (params) => {
      return params.notebookId && typeof params.notebookId === 'string';
    },
  },
  
  // Level 3: 文档操作工具
  create_document: {
    name: 'create_document',
    level: 3,
    dependencies: ['list_notebooks', 'get_notebook_info'],
    requiresValidation: true,
    validator: async (params) => {
      return (
        params.notebook && 
        typeof params.notebook === 'string' &&
        params.title && 
        typeof params.title === 'string' &&
        params.title.trim().length > 0
      );
    },
  },
  
  get_document_info: {
    name: 'get_document_info',
    level: 3,
    dependencies: ['list_notebooks'],
    requiresValidation: true,
    validator: async (params) => {
      return params.documentId && typeof params.documentId === 'string';
    },
  },
  
  update_document: {
    name: 'update_document',
    level: 3,
    dependencies: ['get_document_info'],
    requiresValidation: true,
    validator: async (params) => {
      return params.documentId && typeof params.documentId === 'string';
    },
  },
  
  // Level 4: 块操作工具
  create_block: {
    name: 'create_block',
    level: 4,
    dependencies: ['get_document_info'],
    requiresValidation: true,
    validator: async (params) => {
      return (
        params.parentId && 
        typeof params.parentId === 'string' &&
        params.content && 
        typeof params.content === 'string'
      );
    },
  },
  
  update_block: {
    name: 'update_block',
    level: 4,
    dependencies: ['get_block_info'],
    requiresValidation: true,
    validator: async (params) => {
      return params.blockId && typeof params.blockId === 'string';
    },
  },
  
  delete_block: {
    name: 'delete_block',
    level: 4,
    dependencies: ['get_block_info'],
    requiresValidation: true,
    validator: async (params) => {
      return params.blockId && typeof params.blockId === 'string';
    },
  },
  
  move_block: {
    name: 'move_block',
    level: 4,
    dependencies: ['get_block_info'],
    requiresValidation: true,
    validator: async (params) => {
      return (
        params.blockId && 
        typeof params.blockId === 'string' &&
        params.targetParentId && 
        typeof params.targetParentId === 'string'
      );
    },
  },
};

/**
 * 工具调用优先级管理器类
 */
export class ToolPriorityManager {
  private static instance: ToolPriorityManager;
  private toolCache = new Map<string, any>();
  
  private constructor() {}
  
  /**
   * 获取单例实例
   */
  public static getInstance(): ToolPriorityManager {
    if (!ToolPriorityManager.instance) {
      ToolPriorityManager.instance = new ToolPriorityManager();
    }
    return ToolPriorityManager.instance;
  }
  
  /**
   * 获取工具的优先级信息
   * @param toolName 工具名称
   * @returns 优先级信息
   */
  public getToolPriority(toolName: string): ToolDependency | null {
    return TOOL_PRIORITIES[toolName] || null;
  }
  
  /**
   * 验证工具调用的前置条件
   * @param toolName 工具名称
   * @param params 调用参数
   * @returns 验证结果
   */
  public async validateToolCall(toolName: string, params: any): Promise<{
    valid: boolean;
    error?: string;
    missingDependencies?: string[];
  }> {
    const priority = this.getToolPriority(toolName);
    
    if (!priority) {
      return {
        valid: false,
        error: `未知的工具: ${toolName}`,
      };
    }
    
    // 检查依赖关系
    const missingDependencies = this.checkDependencies(toolName);
    if (missingDependencies.length > 0) {
      return {
        valid: false,
        error: `缺少依赖工具的调用记录`,
        missingDependencies,
      };
    }
    
    // 执行参数验证
    if (priority.requiresValidation && priority.validator) {
      try {
        const isValid = await priority.validator(params);
        if (!isValid) {
          return {
            valid: false,
            error: `工具 ${toolName} 的参数验证失败`,
          };
        }
      } catch (error) {
        return {
          valid: false,
          error: `工具 ${toolName} 的参数验证出错: ${error}`,
        };
      }
    }
    
    return { valid: true };
  }
  
  /**
   * 检查工具的依赖关系
   * @param toolName 工具名称
   * @returns 缺失的依赖工具列表
   */
  private checkDependencies(toolName: string): string[] {
    const priority = this.getToolPriority(toolName);
    if (!priority) return [];
    
    const missingDependencies: string[] = [];
    
    for (const dependency of priority.dependencies) {
      if (!this.toolCache.has(dependency)) {
        missingDependencies.push(dependency);
      }
    }
    
    return missingDependencies;
  }
  
  /**
   * 记录工具调用
   * @param toolName 工具名称
   * @param result 调用结果
   */
  public recordToolCall(toolName: string, result: any): void {
    this.toolCache.set(toolName, {
      timestamp: Date.now(),
      result,
    });
  }
  
  /**
   * 获取工具调用记录
   * @param toolName 工具名称
   * @returns 调用记录
   */
  public getToolCallRecord(toolName: string): any {
    return this.toolCache.get(toolName);
  }
  
  /**
   * 清除工具调用缓存
   */
  public clearCache(): void {
    this.toolCache.clear();
  }
  
  /**
   * 获取推荐的工具调用顺序
   * @param tools 要调用的工具列表
   * @returns 排序后的工具列表
   */
  public getRecommendedCallOrder(tools: string[]): string[] {
    return tools
      .map(tool => ({
        name: tool,
        priority: this.getToolPriority(tool),
      }))
      .filter(item => item.priority !== null)
      .sort((a, b) => {
        // 按优先级等级排序
        if (a.priority!.level !== b.priority!.level) {
          return a.priority!.level - b.priority!.level;
        }
        // 同等级按依赖数量排序
        return a.priority!.dependencies.length - b.priority!.dependencies.length;
      })
      .map(item => item.name);
  }
  
  /**
   * 生成工具调用建议
   * @param toolName 目标工具名称
   * @returns 调用建议
   */
  public generateCallSuggestion(toolName: string): {
    suggestedOrder: string[];
    explanation: string;
  } {
    const priority = this.getToolPriority(toolName);
    
    if (!priority) {
      return {
        suggestedOrder: [],
        explanation: `未知工具: ${toolName}`,
      };
    }
    
    const allRequiredTools = this.getAllRequiredTools(toolName);
    const suggestedOrder = this.getRecommendedCallOrder(allRequiredTools);
    
    const explanation = this.generateExplanation(toolName, suggestedOrder);
    
    return {
      suggestedOrder,
      explanation,
    };
  }
  
  /**
   * 获取工具的所有依赖工具（递归）
   * @param toolName 工具名称
   * @returns 所有依赖工具列表
   */
  private getAllRequiredTools(toolName: string): string[] {
    const visited = new Set<string>();
    const result: string[] = [];
    
    const traverse = (name: string) => {
      if (visited.has(name)) return;
      visited.add(name);
      
      const priority = this.getToolPriority(name);
      if (!priority) return;
      
      // 先处理依赖
      for (const dependency of priority.dependencies) {
        traverse(dependency);
      }
      
      // 再添加当前工具
      result.push(name);
    };
    
    traverse(toolName);
    return result;
  }
  
  /**
   * 生成调用顺序的解释说明
   * @param targetTool 目标工具
   * @param order 调用顺序
   * @returns 解释说明
   */
  private generateExplanation(targetTool: string, order: string[]): string {
    const explanations: string[] = [];
    
    explanations.push(`为了安全调用 ${targetTool}，建议按以下顺序执行：\n`);
    
    order.forEach((tool, index) => {
      const priority = this.getToolPriority(tool);
      if (priority) {
        explanations.push(
          `${index + 1}. ${tool} (Level ${priority.level}) - ${this.getToolDescription(tool)}`
        );
      }
    });
    
    return explanations.join('\n');
  }
  
  /**
   * 获取工具的描述信息
   * @param toolName 工具名称
   * @returns 描述信息
   */
  private getToolDescription(toolName: string): string {
    const descriptions: Record<string, string> = {
      list_notebooks: '获取所有笔记本列表，为后续操作提供基础数据',
      search_blocks: '搜索内容块，用于查找特定内容',
      get_block_info: '获取指定块的详细信息',
      create_notebook: '创建新笔记本，确保目标容器存在',
      get_notebook_info: '获取笔记本详细信息，验证笔记本状态',
      list_documents: '列出笔记本下的所有文档',
      create_document: '在指定笔记本下创建新文档',
      get_document_info: '获取文档详细信息',
      update_document: '更新文档内容',
      create_block: '在文档中创建新的内容块',
      update_block: '更新现有内容块',
      delete_block: '删除指定内容块',
      move_block: '移动内容块到新位置',
    };
    
    return descriptions[toolName] || '执行相关操作';
  }
}
/**
 * 标准化工具类型定义
 * 确保MCP AI模块能够准确调用不同函数
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * 标准响应接口 - 统一所有工具的返回格式
 */
export interface StandardToolResponse {
  success: boolean;
  message: string;
  data: any;
  error?: string;
  timestamp: string;
  executionTime: number;
  metadata?: {
    toolName: string;
    version: string;
    parameters: Record<string, any>;
    performance?: {
      memoryUsage: number;
      apiCalls: number;
      cacheHits: number;
    };
  };
}

/**
 * 工具执行上下文接口
 */
export interface ToolExecutionContext {
  toolName: string;
  parameters: Record<string, any>;
  startTime: number;
  userId?: string;
  sessionId?: string;
  requestId?: string;
}

/**
 * 错误类型枚举
 */
export enum ToolErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR'
}

/**
 * 标准化工具错误类
 */
export class StandardToolError extends Error {
  public readonly type: ToolErrorType;
  public readonly code: string;
  public readonly details: Record<string, any>;
  public readonly timestamp: string;

  constructor(
    type: ToolErrorType,
    message: string,
    code: string = 'UNKNOWN',
    details: Record<string, any> = {}
  ) {
    super(message);
    this.name = 'StandardToolError';
    this.type = type;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  /**
   * 转换为标准响应格式
   */
  toStandardResponse(toolName: string, executionTime: number): StandardToolResponse {
    return {
      success: false,
      message: this.message,
      data: null,
      error: `${this.type}: ${this.code}`,
      timestamp: this.timestamp,
      executionTime,
      metadata: {
        toolName,
        version: '1.0.0',
        parameters: this.details
      }
    };
  }
}

/**
 * 参数验证规则接口
 */
export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any) => boolean | string;
}

/**
 * 工具配置接口
 */
export interface ToolConfig {
  name: string;
  description: string;
  version: string;
  category: string;
  tags: string[];
  timeout: number;
  retryAttempts: number;
  cacheEnabled: boolean;
  cacheTTL: number;
  rateLimitPerMinute: number;
  validationRules: ValidationRule[];
  requiredPermissions: string[];
}

/**
 * 标准化工具基类
 */
export abstract class StandardTool {
  protected config: ToolConfig;
  protected executionContext?: ToolExecutionContext;

  constructor(config: ToolConfig) {
    this.config = config;
  }

  /**
   * 获取工具定义（MCP格式）
   */
  abstract getToolDefinition(): Tool;

  /**
   * 执行工具逻辑
   */
  abstract execute(parameters: Record<string, any>): Promise<any>;

  /**
   * 参数验证
   */
  protected validateParameters(parameters: Record<string, any>): void {
    for (const rule of this.config.validationRules) {
      const value = parameters[rule.field];

      // 检查必填字段
      if (rule.required && (value === undefined || value === null || value === '')) {
        throw new StandardToolError(
          ToolErrorType.VALIDATION_ERROR,
          `必填参数 '${rule.field}' 不能为空`,
          'REQUIRED_FIELD_MISSING',
          { field: rule.field, value }
        );
      }

      // 如果值为空且非必填，跳过后续验证
      if (value === undefined || value === null) continue;

      // 类型验证
      if (rule.type && !this.validateType(value, rule.type)) {
        throw new StandardToolError(
          ToolErrorType.VALIDATION_ERROR,
          `参数 '${rule.field}' 类型错误，期望 ${rule.type}，实际 ${typeof value}`,
          'INVALID_TYPE',
          { field: rule.field, expectedType: rule.type, actualType: typeof value, value }
        );
      }

      // 字符串长度验证
      if (rule.type === 'string' && typeof value === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          throw new StandardToolError(
            ToolErrorType.VALIDATION_ERROR,
            `参数 '${rule.field}' 长度不能少于 ${rule.minLength} 个字符`,
            'MIN_LENGTH_VIOLATION',
            { field: rule.field, minLength: rule.minLength, actualLength: value.length }
          );
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          throw new StandardToolError(
            ToolErrorType.VALIDATION_ERROR,
            `参数 '${rule.field}' 长度不能超过 ${rule.maxLength} 个字符`,
            'MAX_LENGTH_VIOLATION',
            { field: rule.field, maxLength: rule.maxLength, actualLength: value.length }
          );
        }
      }

      // 数值范围验证
      if (rule.type === 'number' && typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          throw new StandardToolError(
            ToolErrorType.VALIDATION_ERROR,
            `参数 '${rule.field}' 不能小于 ${rule.min}`,
            'MIN_VALUE_VIOLATION',
            { field: rule.field, min: rule.min, actualValue: value }
          );
        }
        if (rule.max !== undefined && value > rule.max) {
          throw new StandardToolError(
            ToolErrorType.VALIDATION_ERROR,
            `参数 '${rule.field}' 不能大于 ${rule.max}`,
            'MAX_VALUE_VIOLATION',
            { field: rule.field, max: rule.max, actualValue: value }
          );
        }
      }

      // 正则表达式验证
      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        throw new StandardToolError(
          ToolErrorType.VALIDATION_ERROR,
          `参数 '${rule.field}' 格式不正确`,
          'PATTERN_MISMATCH',
          { field: rule.field, pattern: rule.pattern.source, value }
        );
      }

      // 枚举值验证
      if (rule.enum && !rule.enum.includes(value)) {
        throw new StandardToolError(
          ToolErrorType.VALIDATION_ERROR,
          `参数 '${rule.field}' 必须是以下值之一: ${rule.enum.join(', ')}`,
          'INVALID_ENUM_VALUE',
          { field: rule.field, allowedValues: rule.enum, actualValue: value }
        );
      }

      // 自定义验证
      if (rule.custom) {
        const customResult = rule.custom(value);
        if (customResult !== true) {
          const errorMessage = typeof customResult === 'string' ? customResult : `参数 '${rule.field}' 自定义验证失败`;
          throw new StandardToolError(
            ToolErrorType.VALIDATION_ERROR,
            errorMessage,
            'CUSTOM_VALIDATION_FAILED',
            { field: rule.field, value }
          );
        }
      }
    }
  }

  /**
   * 类型验证辅助方法
   */
  private validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * 创建标准响应
   */
  protected createStandardResponse(
    success: boolean,
    message: string,
    data: any = null,
    error?: string
  ): StandardToolResponse {
    const executionTime = this.executionContext 
      ? Date.now() - this.executionContext.startTime 
      : 0;

    return {
      success,
      message,
      data,
      error,
      timestamp: new Date().toISOString(),
      executionTime,
      metadata: {
        toolName: this.config.name,
        version: this.config.version,
        parameters: this.executionContext?.parameters || {}
      }
    };
  }

  /**
   * 执行工具（带标准化处理）
   */
  async executeWithStandardization(parameters: Record<string, any>): Promise<StandardToolResponse> {
    const startTime = Date.now();
    
    this.executionContext = {
      toolName: this.config.name,
      parameters,
      startTime,
      requestId: this.generateRequestId()
    };

    try {
      // 参数验证
      this.validateParameters(parameters);

      // 执行工具逻辑
      const result = await this.execute(parameters);

      // 返回成功响应
      return this.createStandardResponse(
        true,
        `${this.config.name} 执行成功`,
        result
      );

    } catch (error: any) {
      // 处理标准化错误
      if (error instanceof StandardToolError) {
        return error.toStandardResponse(this.config.name, Date.now() - startTime);
      }

      // 处理其他错误
      const standardError = new StandardToolError(
        ToolErrorType.INTERNAL_ERROR,
        error.message || '工具执行失败',
        'EXECUTION_FAILED',
        { originalError: error.toString() }
      );

      return standardError.toStandardResponse(this.config.name, Date.now() - startTime);
    }
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `${this.config.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * 工具注册表接口
 */
export interface ToolRegistry {
  register(tool: StandardTool): void;
  unregister(toolName: string): void;
  get(toolName: string): StandardTool | undefined;
  list(): StandardTool[];
  execute(toolName: string, parameters: Record<string, any>): Promise<StandardToolResponse>;
}
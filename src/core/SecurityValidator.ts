/**
 * 安全验证器
 * 提供统一的安全验证和权限控制功能
 */

import logger from '../logger.js';

export interface RequestContext {
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  requestId: string;
  operation: string;
  resource?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  context?: RequestContext;
  securityLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityConfig {
  enableRateLimit: boolean;
  enableInputValidation: boolean;
  enableAuditLog: boolean;
  maxRequestsPerMinute: number;
  blockedIPs: string[];
  allowedOperations: string[];
  adminUsers: string[];
}

/**
 * 安全验证器类
 */
export class SecurityValidator {
  private config: SecurityConfig;
  private requestCounts = new Map<string, { count: number; resetTime: number }>();

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      enableRateLimit: true,
      enableInputValidation: true,
      enableAuditLog: true,
      maxRequestsPerMinute: 60,
      blockedIPs: [],
      allowedOperations: [],
      adminUsers: [],
      ...config
    };
  }

  /**
   * 验证请求上下文
   */
  validateRequest(context: RequestContext): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      context,
      securityLevel: 'low'
    };

    try {
      // 1. IP地址检查
      if (context.ipAddress && this.config.blockedIPs.includes(context.ipAddress)) {
        result.isValid = false;
        result.errors.push(`IP地址 ${context.ipAddress} 已被阻止`);
        result.securityLevel = 'critical';
      }

      // 2. 速率限制检查
      if (this.config.enableRateLimit && context.userId) {
        const rateLimitResult = this.checkRateLimit(context.userId);
        if (!rateLimitResult.allowed) {
          result.isValid = false;
          result.errors.push('请求频率超过限制');
          result.securityLevel = 'high';
        }
      }

      // 3. 操作权限检查
      if (this.config.allowedOperations.length > 0 && 
          !this.config.allowedOperations.includes(context.operation)) {
        result.isValid = false;
        result.errors.push(`操作 ${context.operation} 不被允许`);
        result.securityLevel = 'medium';
      }

      // 4. 审计日志
      if (this.config.enableAuditLog) {
        this.logSecurityEvent(context, result);
      }

    } catch (error: any) {
      result.isValid = false;
      result.errors.push(`安全验证失败: ${error.message}`);
      result.securityLevel = 'critical';
      
      // 记录安全验证错误到stderr
      // 完全禁用日志输出 - 用户不需要任何日志
    }

    return result;
  }

  /**
   * 验证输入参数
   */
  validateInput(input: any, schema?: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      securityLevel: 'low'
    };

    if (!this.config.enableInputValidation) {
      return result;
    }

    try {
      // 基本输入验证
      if (input === null || input === undefined) {
        result.warnings.push('输入为空');
        return result;
      }

      // 检查危险字符
      if (typeof input === 'string') {
        const dangerousPatterns = [
          /<script/i,
          /javascript:/i,
          /on\w+\s*=/i,
          /eval\s*\(/i,
          /expression\s*\(/i
        ];

        for (const pattern of dangerousPatterns) {
          if (pattern.test(input)) {
            result.isValid = false;
            result.errors.push('输入包含潜在危险内容');
            result.securityLevel = 'high';
            break;
          }
        }
      }

      // 检查输入长度
      if (typeof input === 'string' && input.length > 10000) {
        result.warnings.push('输入内容过长');
        result.securityLevel = 'medium';
      }

    } catch (error: any) {
      result.isValid = false;
      result.errors.push(`输入验证失败: ${error.message}`);
      result.securityLevel = 'critical';
    }

    return result;
  }

  /**
   * 检查用户权限
   */
  checkPermission(userId: string, operation: string, resource?: string): boolean {
    try {
      // 管理员用户拥有所有权限
      if (this.config.adminUsers.includes(userId)) {
        return true;
      }

      // 基本权限检查逻辑
      // 这里可以根据实际需求扩展更复杂的权限模型
      return true;

    } catch (error: any) {
      // 完全禁用日志输出 - 用户不需要任何日志
      return false;
    }
  }

  /**
   * 速率限制检查
   */
  private checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const windowStart = Math.floor(now / 60000) * 60000; // 1分钟窗口
    
    const userKey = `rate_limit_${userId}`;
    const current = this.requestCounts.get(userKey);

    if (!current || current.resetTime !== windowStart) {
      // 新的时间窗口
      this.requestCounts.set(userKey, { count: 1, resetTime: windowStart });
      return { allowed: true, remaining: this.config.maxRequestsPerMinute - 1 };
    }

    if (current.count >= this.config.maxRequestsPerMinute) {
      return { allowed: false, remaining: 0 };
    }

    current.count++;
    return { allowed: true, remaining: this.config.maxRequestsPerMinute - current.count };
  }

  /**
   * 记录安全事件
   */
  private logSecurityEvent(context: RequestContext, result: ValidationResult): void {
    const logEntry = {
      timestamp: context.timestamp,
      requestId: context.requestId,
      userId: context.userId,
      operation: context.operation,
      resource: context.resource,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      isValid: result.isValid,
      securityLevel: result.securityLevel,
      errors: result.errors,
      warnings: result.warnings
    };

    // 输出到stderr以避免污染MCP协议的stdout
    // 完全禁用日志输出 - 用户不需要任何日志
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取当前配置
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * 清理过期的速率限制记录
   */
  cleanup(): void {
    const now = Date.now();
    const cutoff = now - 60000; // 1分钟前

    for (const [key, value] of this.requestCounts.entries()) {
      if (value.resetTime < cutoff) {
        this.requestCounts.delete(key);
      }
    }
  }
}

// 导出全局安全验证器实例
export const securityValidator = new SecurityValidator();

// 定期清理过期记录
setInterval(() => {
  securityValidator.cleanup();
}, 60000); // 每分钟清理一次

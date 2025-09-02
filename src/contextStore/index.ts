import logger from '../logger';

// 上下文类型定义
export interface SessionContext {
  id: string;
  userId?: string;
  createdAt: Date;
  lastAccessedAt: Date;
  data: Record<string, any>;
}

export interface ToolReturnContext {
  toolName: string;
  requestId: string;
  timestamp: Date;
  input: any;
  output: any;
  success: boolean;
  error?: string;
}

export interface ReferenceContext {
  type: 'block' | 'document' | 'selection';
  id: string;
  content?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

// 上下文存储接口
export interface ContextStore {
  // 会话上下文管理
  createSession(userId?: string): Promise<SessionContext>;
  getSession(sessionId: string): Promise<SessionContext | null>;
  updateSession(sessionId: string, data: Record<string, any>): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  listSessions(userId?: string): Promise<SessionContext[]>;

  // 工具返回上下文管理
  addToolReturn(context: ToolReturnContext): Promise<void>;
  getToolReturns(sessionId?: string, toolName?: string, limit?: number): Promise<ToolReturnContext[]>;
  clearToolReturns(sessionId?: string, olderThan?: Date): Promise<void>;

  // 引用上下文管理
  addReference(sessionId: string, context: ReferenceContext): Promise<void>;
  getReferences(sessionId: string, type?: ReferenceContext['type']): Promise<ReferenceContext[]>;
  removeReference(sessionId: string, referenceId: string): Promise<void>;
  clearReferences(sessionId: string): Promise<void>;
}

// 内存实现的上下文存储
export class MemoryContextStore implements ContextStore {
  private sessions = new Map<string, SessionContext>();
  private toolReturns = new Map<string, ToolReturnContext[]>();
  private references = new Map<string, ReferenceContext[]>();

  async createSession(userId?: string): Promise<SessionContext> {
    const session: SessionContext = {
      id: this.generateId(),
      userId,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      data: {}
    };
    
    this.sessions.set(session.id, session);
    logger.info({ sessionId: session.id, userId }, 'Created new session');
    return session;
  }

  async getSession(sessionId: string): Promise<SessionContext | null> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastAccessedAt = new Date();
      this.sessions.set(sessionId, session);
    }
    return session || null;
  }

  async updateSession(sessionId: string, data: Record<string, any>): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    session.data = { ...session.data, ...data };
    session.lastAccessedAt = new Date();
    this.sessions.set(sessionId, session);
    
    logger.debug({ sessionId, data }, 'Updated session data');
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    this.toolReturns.delete(sessionId);
    this.references.delete(sessionId);
    
    logger.info({ sessionId }, 'Deleted session');
  }

  async listSessions(userId?: string): Promise<SessionContext[]> {
    const sessions = Array.from(this.sessions.values());
    return userId ? sessions.filter(s => s.userId === userId) : sessions;
  }

  async addToolReturn(context: ToolReturnContext): Promise<void> {
    const sessionReturns = this.toolReturns.get(context.requestId) || [];
    sessionReturns.push(context);
    this.toolReturns.set(context.requestId, sessionReturns);
    
    logger.debug({ 
      toolName: context.toolName, 
      requestId: context.requestId, 
      success: context.success 
    }, 'Added tool return context');
  }

  async getToolReturns(sessionId?: string, toolName?: string, limit = 100): Promise<ToolReturnContext[]> {
    let returns: ToolReturnContext[] = [];
    
    if (sessionId) {
      returns = this.toolReturns.get(sessionId) || [];
    } else {
      returns = Array.from(this.toolReturns.values()).flat();
    }
    
    if (toolName) {
      returns = returns.filter(r => r.toolName === toolName);
    }
    
    return returns
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async clearToolReturns(sessionId?: string, olderThan?: Date): Promise<void> {
    if (sessionId) {
      if (olderThan) {
        const returns = this.toolReturns.get(sessionId) || [];
        const filtered = returns.filter(r => r.timestamp > olderThan);
        this.toolReturns.set(sessionId, filtered);
      } else {
        this.toolReturns.delete(sessionId);
      }
    } else if (olderThan) {
      for (const [key, returns] of this.toolReturns.entries()) {
        const filtered = returns.filter(r => r.timestamp > olderThan);
        this.toolReturns.set(key, filtered);
      }
    } else {
      this.toolReturns.clear();
    }
    
    logger.info({ sessionId, olderThan }, 'Cleared tool returns');
  }

  async addReference(sessionId: string, context: ReferenceContext): Promise<void> {
    const sessionRefs = this.references.get(sessionId) || [];
    sessionRefs.push(context);
    this.references.set(sessionId, sessionRefs);
    
    logger.debug({ 
      sessionId, 
      type: context.type, 
      id: context.id 
    }, 'Added reference context');
  }

  async getReferences(sessionId: string, type?: ReferenceContext['type']): Promise<ReferenceContext[]> {
    const refs = this.references.get(sessionId) || [];
    return type ? refs.filter(r => r.type === type) : refs;
  }

  async removeReference(sessionId: string, referenceId: string): Promise<void> {
    const refs = this.references.get(sessionId) || [];
    const filtered = refs.filter(r => r.id !== referenceId);
    this.references.set(sessionId, filtered);
    
    logger.debug({ sessionId, referenceId }, 'Removed reference context');
  }

  async clearReferences(sessionId: string): Promise<void> {
    this.references.delete(sessionId);
    logger.info({ sessionId }, 'Cleared all references');
  }

  private generateId(): string {
    return `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 创建默认的上下文存储实例
export const contextStore = new MemoryContextStore();
import { contextStore, SessionContext, ToolReturnContext, ReferenceContext } from './index';
import { createSiyuanClient } from '../siyuanClient';
import logger from '../logger';

export class ContextManager {
  private siyuanClient;
  
  constructor() {
    this.siyuanClient = createSiyuanClient({
      baseURL: process.env.SIYUAN_BASE_URL || undefined,
      token: process.env.SIYUAN_TOKEN || '',
      autoDiscoverPort: true
    });
  }

  // 会话管理
  async createSession(userId?: string): Promise<SessionContext> {
    return await contextStore.createSession(userId);
  }

  async getOrCreateSession(sessionId?: string, userId?: string): Promise<SessionContext> {
    if (sessionId) {
      const existing = await contextStore.getSession(sessionId);
      if (existing) return existing;
    }
    return await this.createSession(userId);
  }

  async updateSessionContext(sessionId: string, key: string, value: any): Promise<void> {
    await contextStore.updateSession(sessionId, { [key]: value });
  }

  async getSessionContext(sessionId: string, key?: string): Promise<any> {
    const session = await contextStore.getSession(sessionId);
    if (!session) return null;
    return key ? session.data[key] : session.data;
  }

  // 工具返回上下文管理
  async recordToolExecution(
    toolName: string,
    requestId: string,
    input: any,
    output: any,
    success: boolean,
    error?: string
  ): Promise<void> {
    const context: ToolReturnContext = {
      toolName,
      requestId,
      timestamp: new Date(),
      input,
      output,
      success,
      error
    };
    
    await contextStore.addToolReturn(context);
  }

  async getRecentToolReturns(sessionId?: string, toolName?: string, limit = 10): Promise<ToolReturnContext[]> {
    return await contextStore.getToolReturns(sessionId, toolName, limit);
  }

  // 引用上下文管理
  async addBlockReference(sessionId: string, blockId: string): Promise<void> {
    try {
      const blockData = await this.siyuanClient.blocks.getBlock(blockId);
      const context: ReferenceContext = {
        type: 'block',
        id: blockId,
        content: blockData?.content,
        metadata: {
          type: blockData?.type,
          parent: blockData?.parent_id,
          created: blockData?.created,
          updated: blockData?.updated
        },
        timestamp: new Date()
      };
      
      await contextStore.addReference(sessionId, context);
      logger.info({ sessionId, blockId }, 'Added block reference to context');
    } catch (error) {
      logger.error({ error, sessionId, blockId }, 'Failed to add block reference');
      throw error;
    }
  }

  async addDocumentReference(sessionId: string, docId: string): Promise<void> {
    try {
      // 获取文档信息
      const docInfo = await this.siyuanClient.request('/api/filetree/getDoc', { id: docId });
      const docData = docInfo?.data || docInfo;
      const context: ReferenceContext = {
        type: 'document',
        id: docId,
        content: docInfo?.name,
        metadata: {
          path: docInfo?.path,
          notebook: docInfo?.box,
          created: docInfo?.created,
          updated: docInfo?.updated
        },
        timestamp: new Date()
      };
      
      await contextStore.addReference(sessionId, context);
      logger.info({ sessionId, docId }, 'Added document reference to context');
    } catch (error) {
      logger.error({ error, sessionId, docId }, 'Failed to add document reference');
      throw error;
    }
  }

  async addSelectionReference(sessionId: string, selectionId: string, content: string, metadata?: Record<string, any>): Promise<void> {
    const context: ReferenceContext = {
      type: 'selection',
      id: selectionId,
      content,
      metadata,
      timestamp: new Date()
    };
    
    await contextStore.addReference(sessionId, context);
    logger.info({ sessionId, selectionId }, 'Added selection reference to context');
  }

  async getReferences(sessionId: string, type?: ReferenceContext['type']): Promise<ReferenceContext[]> {
    return await contextStore.getReferences(sessionId, type);
  }

  // 上下文合并策略
  async mergeContexts(sessionId: string, strategy: 'recent' | 'relevant' | 'all' = 'recent'): Promise<{
    session: SessionContext | null;
    toolReturns: ToolReturnContext[];
    references: ReferenceContext[];
  }> {
    const session = await contextStore.getSession(sessionId);
    let toolReturns: ToolReturnContext[] = [];
    let references: ReferenceContext[] = [];

    switch (strategy) {
      case 'recent':
        toolReturns = await this.getRecentToolReturns(sessionId, undefined, 5);
        references = (await this.getReferences(sessionId))
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 10);
        break;
        
      case 'relevant':
        // 基于当前会话数据的相关性过滤
        toolReturns = await this.getRecentToolReturns(sessionId, undefined, 10);
        references = await this.getReferences(sessionId);
        break;
        
      case 'all':
        toolReturns = await contextStore.getToolReturns(sessionId);
        references = await this.getReferences(sessionId);
        break;
    }

    return { session, toolReturns, references };
  }

  // 上下文清理
  async cleanupOldContexts(olderThanHours = 24): Promise<void> {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    // 清理旧的工具返回
    await contextStore.clearToolReturns(undefined, cutoffTime);
    
    // 清理旧的会话
    const sessions = await contextStore.listSessions();
    for (const session of sessions) {
      if (session.lastAccessedAt < cutoffTime) {
        await contextStore.deleteSession(session.id);
      }
    }
    
    logger.info({ olderThanHours }, 'Cleaned up old contexts');
  }

  // 导出上下文摘要
  async exportContextSummary(sessionId: string): Promise<{
    sessionInfo: SessionContext | null;
    recentActivity: ToolReturnContext[];
    activeReferences: ReferenceContext[];
    summary: string;
  }> {
    const { session, toolReturns, references } = await this.mergeContexts(sessionId, 'recent');
    
    const summary = this.generateContextSummary(session, toolReturns, references);
    
    return {
      sessionInfo: session,
      recentActivity: toolReturns,
      activeReferences: references,
      summary
    };
  }

  private generateContextSummary(
    session: SessionContext | null,
    toolReturns: ToolReturnContext[],
    references: ReferenceContext[]
  ): string {
    const parts: string[] = [];
    
    if (session) {
      parts.push(`会话 ${session.id} (创建于 ${session.createdAt.toISOString()})`);
      if (Object.keys(session.data).length > 0) {
        parts.push(`会话数据: ${JSON.stringify(session.data)}`);
      }
    }
    
    if (toolReturns.length > 0) {
      parts.push(`最近工具调用 (${toolReturns.length}个):`);
      toolReturns.forEach(tr => {
        parts.push(`- ${tr.toolName}: ${tr.success ? '成功' : '失败'} (${tr.timestamp.toISOString()})`);
      });
    }
    
    if (references.length > 0) {
      parts.push(`活跃引用 (${references.length}个):`);
      references.forEach(ref => {
        parts.push(`- ${ref.type}: ${ref.id} (${ref.timestamp.toISOString()})`);
      });
    }
    
    return parts.join('\n');
  }
}

export const contextManager = new ContextManager();
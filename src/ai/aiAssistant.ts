import { SiyuanClient } from '../siyuanClient';
import logger from '../logger';

interface AIContext {
  sessionId: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    metadata?: Record<string, any>;
  }>;
  activeDocuments: string[];
  referencedBlocks: string[];
  workingMemory: Record<string, any>;
}

interface AIWorkflowStep {
  id: string;
  type: 'search' | 'create' | 'update' | 'analyze' | 'summarize';
  description: string;
  parameters: Record<string, any>;
  dependencies?: string[];
}

interface AIWorkflow {
  id: string;
  name: string;
  description: string;
  steps: AIWorkflowStep[];
  context: AIContext;
}

class AIAssistant {
  private contexts = new Map<string, AIContext>();
  private workflows = new Map<string, AIWorkflow>();

  constructor(private siyuanClient: SiyuanClient) {}

  /**
   * 创建AI会话上下文
   */
  async createAISession(userId?: string): Promise<AIContext> {
    const sessionId = `ai-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const context: AIContext = {
      sessionId,
      conversationHistory: [],
      activeDocuments: [],
      referencedBlocks: [],
      workingMemory: {
        userId: userId || 'anonymous',
        createdAt: new Date().toISOString(),
        preferences: {},
        statistics: {
          documentsCreated: 0,
          blocksModified: 0,
          searchesPerformed: 0
        }
      }
    };

    this.contexts.set(sessionId, context);
    logger.info({ sessionId, userId }, 'AI会话上下文已创建');
    
    return context;
  }

  /**
   * 智能文档分析
   */
  async analyzeDocument(sessionId: string, docId: string): Promise<{
    summary: string;
    keyPoints: string[];
    structure: any;
    suggestions: string[];
    relatedDocs: string[];
  }> {
    const context = this.contexts.get(sessionId);
    if (!context) {
      throw new Error('AI会话上下文不存在');
    }

    // 获取文档内容 - 需要管理员权限
    let docContent;
    try {
      docContent = await this.siyuanClient.request('/api/export/exportMdContent', {
        id: docId
      });
    } catch (error) {
      logger.warn({ docId, error }, '获取文档Markdown内容失败，尝试获取基础文档信息');
      // 降级到获取基础文档信息
      docContent = await this.siyuanClient.request('/api/filetree/getDoc', {
        id: docId
      });
    }

    // 获取文档结构
    const docInfo = await this.siyuanClient.request('/api/block/getDocInfo', {
      id: docId
    });

    // 获取子块
    const childBlocks = await this.siyuanClient.request('/api/block/getChildBlocks', {
      id: docId
    });

    // 分析文档结构
    const structure = this.analyzeDocumentStructure(childBlocks);
    
    // 生成摘要和关键点
    const analysis = this.generateDocumentAnalysis(docContent.content, structure);
    
    // 查找相关文档
    const relatedDocs = await this.findRelatedDocuments(docContent.content);

    // 更新上下文
    if (!context.activeDocuments.includes(docId)) {
      context.activeDocuments.push(docId);
    }

    const result = {
      summary: analysis.summary,
      keyPoints: analysis.keyPoints,
      structure,
      suggestions: analysis.suggestions,
      relatedDocs
    };

    logger.info({ sessionId, docId }, '文档分析完成');
    return result;
  }

  /**
   * 智能内容生成
   */
  async generateContent(sessionId: string, prompt: string, options: {
    type: 'document' | 'block' | 'outline' | 'summary';
    style?: 'formal' | 'casual' | 'technical' | 'creative';
    length?: 'short' | 'medium' | 'long';
    references?: string[];
    template?: string;
  }): Promise<{
    content: string;
    metadata: {
      wordCount: number;
      estimatedReadTime: number;
      suggestedTags: string[];
      relatedTopics: string[];
    };
  }> {
    const context = this.contexts.get(sessionId);
    if (!context) {
      throw new Error('AI会话上下文不存在');
    }

    // 收集参考内容
    let referenceContent = '';
    if (options.references) {
      for (const refId of options.references) {
        try {
          const refContent = await this.siyuanClient.request('/api/export/exportMdContent', {
            id: refId
          });
          referenceContent += `\n\n参考内容：\n${refContent.data?.content || refContent.content || ''}`;
        } catch (error) {
          logger.warn({ refId, error }, '获取参考内容失败');
        }
      }
    }

    // 生成内容
    const generatedContent = this.generateContentByType(prompt, options, referenceContent, context);
    
    // 计算元数据
    const wordCount = generatedContent.split(/\s+/).length;
    const estimatedReadTime = Math.ceil(wordCount / 200); // 假设每分钟200字
    const suggestedTags = this.extractTags(generatedContent);
    const relatedTopics = this.extractTopics(generatedContent);

    // 更新统计
    context.workingMemory.statistics.documentsCreated++;

    const result = {
      content: generatedContent,
      metadata: {
        wordCount,
        estimatedReadTime,
        suggestedTags,
        relatedTopics
      }
    };

    logger.info({ sessionId, type: options.type, wordCount }, '内容生成完成');
    return result;
  }

  /**
   * 智能搜索和推荐
   */
  async intelligentSearch(sessionId: string, query: string, options: {
    searchType: 'semantic' | 'keyword' | 'hybrid';
    scope?: 'all' | 'recent' | 'related';
    limit?: number;
    includeContext?: boolean;
  }): Promise<{
    results: Array<{
      id: string;
      title: string;
      content: string;
      relevanceScore: number;
      type: 'document' | 'block';
      path: string;
      highlights: string[];
    }>;
    suggestions: string[];
    relatedQueries: string[];
  }> {
    const context = this.contexts.get(sessionId);
    if (!context) {
      throw new Error('AI会话上下文不存在');
    }

    // 执行基础搜索
    const searchResults = await this.siyuanClient.searchNotes(query, options.limit || 20);
    
    // 增强搜索结果
    const enhancedResults = await this.enhanceSearchResults(
      searchResults.blocks || [], 
      query, 
      options,
      context
    );

    // 生成搜索建议
    const suggestions = this.generateSearchSuggestions(query, context);
    const relatedQueries = this.generateRelatedQueries(query, context);

    // 更新统计
    context.workingMemory.statistics.searchesPerformed++;

    const result = {
      results: enhancedResults,
      suggestions,
      relatedQueries
    };

    logger.info({ sessionId, query, resultCount: enhancedResults.length }, '智能搜索完成');
    return result;
  }

  /**
   * 创建AI工作流
   */
  async createWorkflow(sessionId: string, workflowDef: {
    name: string;
    description: string;
    goal: string;
    steps: Array<{
      type: string;
      description: string;
      parameters: Record<string, any>;
    }>;
  }): Promise<AIWorkflow> {
    const context = this.contexts.get(sessionId);
    if (!context) {
      throw new Error('AI会话上下文不存在');
    }

    const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const workflow: AIWorkflow = {
      id: workflowId,
      name: workflowDef.name,
      description: workflowDef.description,
      steps: workflowDef.steps.map((step, index) => ({
        id: `step-${index + 1}`,
        type: step.type as any,
        description: step.description,
        parameters: step.parameters,
        dependencies: index > 0 ? [`step-${index}`] : undefined
      })),
      context: { ...context }
    };

    this.workflows.set(workflowId, workflow);
    logger.info({ sessionId, workflowId, name: workflowDef.name }, 'AI工作流已创建');
    
    return workflow;
  }

  /**
   * 执行AI工作流
   */
  async executeWorkflow(workflowId: string): Promise<{
    success: boolean;
    results: Array<{
      stepId: string;
      success: boolean;
      result?: any;
      error?: string;
    }>;
    summary: string;
  }> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('工作流不存在');
    }

    const results: Array<{
      stepId: string;
      success: boolean;
      result?: any;
      error?: string;
    }> = [];

    let overallSuccess = true;

    for (const step of workflow.steps) {
      try {
        logger.info({ workflowId, stepId: step.id }, '执行工作流步骤');
        
        const stepResult = await this.executeWorkflowStep(step, workflow.context);
        
        results.push({
          stepId: step.id,
          success: true,
          result: stepResult
        });
        
      } catch (error) {
        logger.error({ workflowId, stepId: step.id, error }, '工作流步骤执行失败');
        
        results.push({
          stepId: step.id,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
        
        overallSuccess = false;
        break; // 停止执行后续步骤
      }
    }

    const summary = this.generateWorkflowSummary(workflow, results);

    logger.info({ workflowId, success: overallSuccess }, '工作流执行完成');
    
    return {
      success: overallSuccess,
      results,
      summary
    };
  }

  /**
   * 获取AI会话统计
   */
  getSessionStats(sessionId: string): any {
    const context = this.contexts.get(sessionId);
    if (!context) {
      throw new Error('AI会话上下文不存在');
    }

    return {
      sessionId,
      ...context.workingMemory.statistics,
      activeDocuments: context.activeDocuments.length,
      referencedBlocks: context.referencedBlocks.length,
      conversationLength: context.conversationHistory.length,
      sessionDuration: Date.now() - new Date(context.workingMemory.createdAt).getTime()
    };
  }

  // 私有辅助方法
  private analyzeDocumentStructure(blocks: any[]): any {
    const structure: {
      headings: Array<{level: number, content: string}>;
      lists: string[];
      codeBlocks: string[];
      tables: string[];
      totalBlocks: number;
    } = {
      headings: [],
      lists: [],
      codeBlocks: [],
      tables: [],
      totalBlocks: blocks.length
    };

    blocks.forEach(block => {
      switch (block.type) {
        case 'h':
          structure.headings.push({
            level: block.subType || 1,
            content: block.content
          });
          break;
        case 'l':
          structure.lists.push(block.content);
          break;
        case 'c':
          structure.codeBlocks.push(block.content);
          break;
        case 't':
          structure.tables.push(block.content);
          break;
      }
    });

    return structure;
  }

  private generateDocumentAnalysis(content: string, structure: any): {
    summary: string;
    keyPoints: string[];
    suggestions: string[];
  } {
    // 简化的文档分析逻辑
    const lines = content.split('\n').filter(line => line.trim());
    const wordCount = content.split(/\s+/).length;
    
    return {
      summary: `文档包含${lines.length}行内容，约${wordCount}个词，包含${structure.headings.length}个标题。`,
      keyPoints: structure.headings.slice(0, 5).map((h: any) => h.content),
      suggestions: [
        '考虑添加目录结构',
        '可以增加更多示例',
        '建议添加相关链接',
        '考虑优化段落结构'
      ]
    };
  }

  private async findRelatedDocuments(content: string): Promise<string[]> {
    // 提取关键词并搜索相关文档
    const keywords = this.extractKeywords(content);
    const relatedDocs: string[] = [];

    for (const keyword of keywords.slice(0, 3)) {
      try {
        const searchResult = await this.siyuanClient.searchNotes(keyword, 3);
        if (searchResult.blocks) {
          searchResult.blocks.forEach((block: any) => {
            if (block.rootID && !relatedDocs.includes(block.rootID)) {
              relatedDocs.push(block.rootID);
            }
          });
        }
      } catch (error) {
        logger.warn({ keyword, error }, '搜索相关文档失败');
      }
    }

    return relatedDocs.slice(0, 5);
  }

  private generateContentByType(
    prompt: string, 
    options: any, 
    referenceContent: string, 
    context: AIContext
  ): string {
    // 根据类型生成不同的内容模板
    const templates = {
      document: this.generateDocumentTemplate(prompt, options, referenceContent),
      block: this.generateBlockTemplate(prompt, options),
      outline: this.generateOutlineTemplate(prompt, options),
      summary: this.generateSummaryTemplate(prompt, referenceContent)
    };

    return templates[options.type as keyof typeof templates] || templates.document;
  }

  private generateDocumentTemplate(prompt: string, options: any, referenceContent: string): string {
    return `# ${prompt}

## 概述
基于您的需求"${prompt}"，这里是生成的文档内容。

## 主要内容

### 背景
${referenceContent ? '基于提供的参考内容：' + referenceContent.substring(0, 200) + '...' : ''}

### 详细说明
这里是根据您的要求生成的详细内容。内容风格为${options.style || '正式'}，长度为${options.length || '中等'}。

### 要点总结
1. 第一个要点
2. 第二个要点
3. 第三个要点

## 结论
总结性内容。

---
*由AI助手生成于 ${new Date().toLocaleString('zh-CN')}*`;
  }

  private generateBlockTemplate(prompt: string, options: any): string {
    return `${prompt}\n\n这是根据您的需求生成的块内容，风格为${options.style || '正式'}。`;
  }

  private generateOutlineTemplate(prompt: string, options: any): string {
    return `# ${prompt} - 大纲

## I. 引言
   A. 背景介绍
   B. 目标说明

## II. 主体内容
   A. 第一部分
      1. 子要点1
      2. 子要点2
   B. 第二部分
      1. 子要点1
      2. 子要点2

## III. 结论
   A. 总结
   B. 建议`;
  }

  private generateSummaryTemplate(prompt: string, referenceContent: string): string {
    return `## ${prompt} - 摘要

基于提供的内容，主要要点如下：

1. **核心观点**: ${referenceContent.substring(0, 100)}...
2. **关键信息**: 从参考内容中提取的重要信息
3. **结论**: 总结性观点

*摘要生成时间: ${new Date().toLocaleString('zh-CN')}*`;
  }

  private async enhanceSearchResults(
    blocks: any[], 
    query: string, 
    options: any, 
    context: AIContext
  ): Promise<any[]> {
    return blocks.map(block => ({
      id: block.id,
      title: block.content.substring(0, 50) + '...',
      content: block.content,
      relevanceScore: this.calculateRelevanceScore(block.content, query),
      type: block.type === 'd' ? 'document' : 'block',
      path: block.hPath || '',
      highlights: this.extractHighlights(block.content, query)
    }));
  }

  private calculateRelevanceScore(content: string, query: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = content.toLowerCase().split(/\s+/);
    
    let matches = 0;
    queryWords.forEach(word => {
      if (contentWords.includes(word)) {
        matches++;
      }
    });
    
    return matches / queryWords.length;
  }

  private extractHighlights(content: string, query: string): string[] {
    const queryWords = query.toLowerCase().split(/\s+/);
    const highlights: string[] = [];
    
    queryWords.forEach(word => {
      const regex = new RegExp(`(.{0,20}${word}.{0,20})`, 'gi');
      const matches = content.match(regex);
      if (matches) {
        highlights.push(...matches.slice(0, 2));
      }
    });
    
    return highlights;
  }

  private generateSearchSuggestions(query: string, context: AIContext): string[] {
    return [
      `${query} 教程`,
      `${query} 示例`,
      `${query} 最佳实践`,
      `如何使用 ${query}`,
      `${query} 相关工具`
    ];
  }

  private generateRelatedQueries(query: string, context: AIContext): string[] {
    return [
      `${query} 进阶`,
      `${query} 问题解决`,
      `${query} 对比分析`,
      `${query} 应用场景`
    ];
  }

  private async executeWorkflowStep(step: AIWorkflowStep, context: AIContext): Promise<any> {
    switch (step.type) {
      case 'search':
        return await this.siyuanClient.searchNotes(
          step.parameters.query, 
          step.parameters.limit || 10
        );
      
      case 'create':
        return await this.siyuanClient.documents.createDoc(
          step.parameters.notebook,
          step.parameters.path,
          step.parameters.title,
          step.parameters.content
        );
      
      case 'analyze':
        return await this.analyzeDocument(context.sessionId, step.parameters.docId);
      
      default:
        throw new Error(`不支持的工作流步骤类型: ${step.type}`);
    }
  }

  private generateWorkflowSummary(workflow: AIWorkflow, results: any[]): string {
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    return `工作流"${workflow.name}"执行完成。成功执行${successCount}/${totalCount}个步骤。`;
  }

  private extractKeywords(content: string): string[] {
    // 简化的关键词提取
    const words = content.toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
    
    const wordCount = new Map<string, number>();
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });
    
    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  private extractTags(content: string): string[] {
    // 提取可能的标签
    const tags: string[] = [];
    
    // 提取标题作为标签
    const headings = content.match(/^#+\s+(.+)$/gm);
    if (headings) {
      headings.forEach(heading => {
        const tag = heading.replace(/^#+\s+/, '').trim();
        if (tag.length < 20) {
          tags.push(tag);
        }
      });
    }
    
    return tags.slice(0, 5);
  }

  private extractTopics(content: string): string[] {
    // 提取主题
    const keywords = this.extractKeywords(content);
    return keywords.slice(0, 3);
  }
}

/**
 * Token优化工具 - 减少AI交互中的token消耗
 */

export interface TokenOptimizationConfig {
  maxContentLength: number;
  summaryLength: number;
  keywordsLimit: number;
  contextWindow: number;
}

export class TokenOptimizer {
  private config: TokenOptimizationConfig;

  constructor(config: Partial<TokenOptimizationConfig> = {}) {
    this.config = {
      maxContentLength: 2000,
      summaryLength: 200,
      keywordsLimit: 10,
      contextWindow: 4000,
      ...config
    };
  }

  /**
   * 压缩文档内容，保留关键信息
   */
  compressContent(content: string): string {
    if (content.length <= this.config.maxContentLength) {
      return content;
    }

    // 提取标题和关键段落
    const lines = content.split('\n');
    const important: string[] = [];
    
    lines.forEach(line => {
      const trimmed = line.trim();
      // 保留标题
      if (trimmed.startsWith('#')) {
        important.push(trimmed);
      }
      // 保留关键词密集的段落
      else if (this.isImportantParagraph(trimmed)) {
        important.push(trimmed.substring(0, 100) + '...');
      }
    });

    return important.join('\n').substring(0, this.config.maxContentLength);
  }

  /**
   * 生成简洁摘要
   */
  generateSummary(content: string): string {
    const compressed = this.compressContent(content);
    const sentences = compressed.split(/[。！？.!?]/).filter(s => s.trim());
    
    // 选择最重要的句子
    const important = sentences
      .filter(s => s.length > 10 && s.length < 100)
      .slice(0, 3)
      .join('。');

    return important.substring(0, this.config.summaryLength);
  }

  /**
   * 提取关键词
   */
  extractKeywords(content: string): string[] {
    const text = content.toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && word.length < 15);

    const frequency: Record<string, number> = {};
    text.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.keywordsLimit)
      .map(([word]) => word);
  }

  /**
   * 优化搜索结果
   */
  optimizeSearchResults(results: any[]): any[] {
    return results.slice(0, 5).map(result => ({
      id: result.id,
      title: this.truncateText(result.title || '', 50),
      content: this.truncateText(result.content || '', 100),
      score: result.score
    }));
  }

  /**
   * 批量操作结果摘要
   */
  summarizeBatchResults(results: any[]): string {
    const success = results.filter(r => r.success).length;
    const total = results.length;
    const errors = results.filter(r => !r.success).length;

    return `批量操作完成: ${success}/${total} 成功${errors > 0 ? `, ${errors}个错误` : ''}`;
  }

  isImportantParagraph(text: string): boolean {
    const keywords = ['重要', '关键', '核心', '主要', '总结', '结论'];
    return keywords.some(keyword => text.includes(keyword)) || text.length > 50;
  }

  truncateText(text: string, maxLength: number): string {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }
}

const tokenOptimizer = new TokenOptimizer();

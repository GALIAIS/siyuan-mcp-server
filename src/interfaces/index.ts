/**
 * 统一接口规范
 * 定义所有模块间的标准接口和类型
 */

// 基础接口
export interface BaseConfig {
  baseURL?: string;
  token: string;
  timeout?: number;
  retryAttempts?: number;
}

// API响应接口
export interface APIResponse<T = any> {
  code: number;
  msg: string;
  data: T;
}

// 分页接口（统一版本）
export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  offset?: number;
  limit?: number;
  orderBy?: string;
  sortBy?: 'created' | 'updated' | 'name' | 'relevance';
  sortOrder?: 'asc' | 'desc';
}

// 基础搜索选项接口（不包含query）
export interface BaseSearchOptions {
  types?: {
    document?: boolean;
    heading?: boolean;
    paragraph?: boolean;
    list?: boolean;
    listItem?: boolean;
    codeBlock?: boolean;
    mathBlock?: boolean;
    table?: boolean;
    blockquote?: boolean;
    superBlock?: boolean;
  };
  method?: number; // 0: 关键字搜索, 1: 查询语法
  orderBy?: number; // 0: 按相关度排序, 1: 按创建时间排序, 2: 按更新时间排序
  groupBy?: number; // 0: 不分组, 1: 按文档分组
  paths?: string[];
  page?: number;
  pageSize?: number;
}

// 搜索选项接口
export interface SearchOptions extends BaseSearchOptions {
  query: string;
}

// 递归搜索选项接口
export interface RecursiveSearchOptions extends BaseSearchOptions {
  maxDepth?: number;
  includeContent?: boolean;
  fuzzyMatch?: boolean;
  limit?: number;
}

// 批量操作选项接口
export interface BatchOptions {
  batchSize?: number;
  maxConcurrency?: number;
  delay?: number;
  retryAttempts?: number;
  timeoutMs?: number;
  memoryThreshold?: number;
}

// 批量操作结果接口
export interface BatchResult<T = any> {
  success: T[];
  failed: Array<{
    index: number;
    error: string;
    input: any;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

// 批量操作请求接口
export interface CreateBlockRequest {
  content: string;
  parentID?: string;
  previousID?: string;
}

export interface UpdateBlockRequest {
  id: string;
  content: string;
  attrs?: Record<string, any>;
}

// 文档接口
export interface Document {
  id: string;
  title: string;
  content?: string;
  notebook: string;
  path: string;
  created?: string;
  updated?: string;
  contentLength?: number;
}

// 笔记本接口
export interface Notebook {
  id: string;
  name: string;
  icon: string;
  closed: boolean;
  sort: number;
}

// 块接口
export interface Block {
  id: string;
  type: string;
  content: string;
  parentID?: string;
  rootID?: string;
  created?: string;
  updated?: string;
}

// 文档树节点接口
export interface DocumentTreeNode {
  id: string;
  title: string;
  type: string;
  notebook?: string;
  path?: string;
  children?: DocumentTreeNode[];
  depth?: number;
  hasChildren?: boolean;
  childrenCount?: number;
}

// 内存使用信息接口
export interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

// 性能内存指标接口
export interface PerformanceMemoryMetrics {
  before: number;
  after: number;
  peak: number;
}

// 性能指标接口
export interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: PerformanceMemoryMetrics | MemoryUsage;
  apiCalls: number;
  cacheHits?: number;
  documentsProcessed?: number;
}

// 移除重复的 CacheConfig 和 LogLevel 定义，使用各自模块中的定义

// 操作结果接口
export interface OperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message: string;
  timestamp: string;
  performance?: PerformanceMetrics;
}

// 健康检查结果接口
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  details: {
    api: boolean;
    database: boolean;
    cache: boolean;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
  };
  timestamp: string;
}

// 模块状态接口
export interface ModuleStatus {
  name: string;
  version: string;
  status: 'active' | 'inactive' | 'error';
  lastActivity: string;
  errorCount: number;
  performance: {
    averageResponseTime: number;
    successRate: number;
    totalRequests: number;
  };
}

// ============================================================================
// 增强的 SiYuan 类型定义 (原 enhanced-siyuan-types.ts 内容)
// ============================================================================

// ==================== 标签管理相关类型 ====================

/**
 * 标签信息接口
 */
export interface TagInfo {
  /** 标签名称 */
  name: string;
  /** 使用次数 */
  count: number;
  /** 标签颜色 */
  color?: string;
  /** 标签描述 */
  description?: string;
  /** 创建时间 */
  createdAt: string;
  /** 最后使用时间 */
  lastUsed: string;
}

/**
 * 获取标签响应接口
 */
export interface GetTagsResponse {
  code: number;
  msg: string;
  data: {
    /** 标签列表 */
    tags: TagInfo[];
    /** 标签总数 */
    total: number;
  };
}

/**
 * 管理块标签请求接口
 */
export interface ManageBlockTagsRequest {
  /** 块ID数组 */
  blockIDs: string[];
  /** 标签数组 */
  tags: string[];
  /** 操作类型 */
  operation: 'add' | 'remove' | 'replace';
}

/**
 * 管理块标签响应接口
 */
export interface ManageBlockTagsResponse {
  code: number;
  msg: string;
  data: {
    /** 处理的块数量 */
    processedBlocks: number;
    /** 成功的操作数 */
    successCount: number;
    /** 失败的操作详情 */
    failures: Array<{
      blockID: string;
      error: string;
    }>;
  };
}

// ==================== 引用关系相关类型 ====================

/**
 * 引用信息接口
 */
export interface ReferenceInfo {
  /** 目标块ID */
  targetID: string;
  /** 目标内容预览 */
  targetContent: string;
  /** 引用上下文 */
  context: string;
  /** 引用类型 */
  type: 'block_ref' | 'embed' | 'link';
}

/**
 * 获取块引用关系请求接口
 */
export interface GetBlockReferencesRequest {
  /** 块ID */
  blockID: string;
  /** 是否包含反向链接 */
  includeBacklinks?: boolean;
  /** 最大深度 */
  maxDepth?: number;
  /** 是否包含上下文 */
  includeContext?: boolean;
}

/**
 * 关系图节点
 */
export interface RelationshipNode {
  /** 节点ID */
  id: string;
  /** 节点内容 */
  content: string;
  /** 节点类型 */
  type: string;
  /** 节点标题 */
  title?: string;
}

/**
 * 关系图边
 */
export interface RelationshipEdge {
  /** 源节点ID */
  source: string;
  /** 目标节点ID */
  target: string;
  /** 关系类型 */
  type: string;
  /** 关系权重 */
  weight?: number;
}

/**
 * 获取块引用关系响应接口
 */
export interface GetBlockReferencesResponse {
  code: number;
  msg: string;
  data: {
    /** 块ID */
    blockID: string;
    /** 引用关系 */
    references: {
      /** 出链（当前块引用的其他块） */
      outgoing: ReferenceInfo[];
      /** 入链（引用当前块的其他块） */
      incoming: ReferenceInfo[];
    };
    /** 关系图谱 */
    relationshipGraph: {
      /** 节点列表 */
      nodes: RelationshipNode[];
      /** 边列表 */
      edges: RelationshipEdge[];
    };
  };
}

// ==================== 高级搜索相关类型 ====================

/**
 * 高级搜索查询条件
 */
export interface AdvancedSearchQuery {
  /** 文本搜索 */
  text?: string;
  /** 标签过滤 */
  tags?: string[];
  /** 笔记本过滤 */
  notebooks?: string[];
  /** 日期范围过滤 */
  dateRange?: {
    /** 日期字段 */
    field: 'created' | 'updated';
    /** 开始日期 */
    start?: string;
    /** 结束日期 */
    end?: string;
  };
  /** 块类型过滤 */
  blockTypes?: string[];
  /** 是否有引用 */
  hasReferences?: boolean;
  /** 作者过滤 */
  author?: string;
  /** 语言过滤 */
  language?: string;
}

/**
 * 高级搜索选项
 */
export interface AdvancedSearchOptions {
  /** 限制结果数量 */
  limit?: number;
  /** 偏移量 */
  offset?: number;
  /** 排序字段 */
  sortBy?: 'relevance' | 'created' | 'updated' | 'title';
  /** 排序顺序 */
  sortOrder?: 'asc' | 'desc';
  /** 是否包含上下文 */
  includeContext?: boolean;
  /** 是否高亮匹配 */
  highlightMatches?: boolean;
}

/**
 * 高级搜索请求接口
 */
export interface AdvancedSearchRequest {
  /** 搜索查询 */
  query: AdvancedSearchQuery;
  /** 搜索选项 */
  options: AdvancedSearchOptions;
}

/**
 * 搜索结果项
 */
export interface SearchResultItem {
  /** 块ID */
  blockID: string;
  /** 文档ID */
  docID: string;
  /** 内容 */
  content: string;
  /** 上下文 */
  context?: string;
  /** 高亮片段 */
  highlights?: string[];
  /** 相关性评分 */
  score: number;
  /** 元数据 */
  metadata: {
    /** 文档标题 */
    title: string;
    /** 笔记本名称 */
    notebook: string;
    /** 创建时间 */
    created: string;
    /** 更新时间 */
    updated: string;
    /** 块类型 */
    blockType: string;
    /** 标签列表 */
    tags: string[];
  };
}

/**
 * 高级搜索响应接口
 */
export interface AdvancedSearchResponse {
  code: number;
  msg: string;
  data: {
    /** 搜索结果 */
    results: SearchResultItem[];
    /** 总结果数 */
    total: number;
    /** 是否有更多结果 */
    hasMore: boolean;
    /** 搜索耗时（毫秒） */
    searchTime: number;
    /** 分面统计（可选） */
    facets?: {
      /** 笔记本分布 */
      notebooks: Record<string, number>;
      /** 标签分布 */
      tags: Record<string, number>;
      /** 块类型分布 */
      blockTypes: Record<string, number>;
    };
  };
}

// 注意：DocumentTreeNode 接口已存在于上方，增强版本中的同名接口已跳过以避免冲突

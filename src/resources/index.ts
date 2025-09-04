import { createSiyuanClient } from '../siyuanClient';
import logger from '../logger';
import { PaginationOptions } from '../interfaces/index.js';

// MCP资源类型定义
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  metadata?: Record<string, any>;
}

// 资源过滤器
export interface ResourceFilter {
  type?: 'document' | 'block' | 'notebook';
  notebook?: string;
  path?: string;
  query?: string;
  tags?: string[];
  dateRange?: {
    start?: Date;
    end?: Date;
  };
}



// 资源发现结果
export interface ResourceDiscoveryResult {
  resources: MCPResource[];
  total: number;
  hasMore: boolean;
  nextOffset?: number;
}

export class ResourceDirectory {
  private siyuanClient;

  constructor() {
    this.siyuanClient = createSiyuanClient({
      baseURL: process.env.SIYUAN_BASE_URL || undefined,
      token: process.env.SIYUAN_TOKEN || '',
      autoDiscoverPort: true
    });
  }

  // 发现所有可用资源
  async discoverResources(
    filter: ResourceFilter = {},
    pagination: PaginationOptions = {}
  ): Promise<ResourceDiscoveryResult> {
    const { offset = 0, limit = 50, sortBy = 'updated', sortOrder = 'desc' } = pagination;
    
    try {
      const resources: MCPResource[] = [];
      let total = 0;

      // 根据过滤器类型获取不同的资源
      if (!filter.type || filter.type === 'notebook') {
        const notebooks = await this.discoverNotebooks(filter);
        resources.push(...notebooks);
        total += notebooks.length;
      }

      if (!filter.type || filter.type === 'document') {
        const documents = await this.discoverDocuments(filter, pagination);
        resources.push(...documents.resources);
        total += documents.total;
      }

      if (!filter.type || filter.type === 'block') {
        const blocks = await this.discoverBlocks(filter, pagination);
        resources.push(...blocks.resources);
        total += blocks.total;
      }

      // 排序
      const sortedResources = this.sortResources(resources, sortBy, sortOrder);
      
      // 分页
      const paginatedResources = sortedResources.slice(offset, offset + limit);
      
      return {
        resources: paginatedResources,
        total,
        hasMore: offset + limit < total,
        nextOffset: offset + limit < total ? offset + limit : undefined
      };

    } catch (error) {
      logger.error({ error, filter, pagination }, 'Failed to discover resources');
      throw error;
    }
  }

  // 发现笔记本资源
  private async discoverNotebooks(filter: ResourceFilter): Promise<MCPResource[]> {
    try {
      const response = await this.siyuanClient.request('/api/notebook/lsNotebooks', {});
      
      // 处理不同的响应格式
      let notebooks = [];
      if (response && response.data && response.data.notebooks) {
        notebooks = response.data.notebooks;
      } else if (response && Array.isArray(response.notebooks)) {
        notebooks = response.notebooks;
      } else if (Array.isArray(response)) {
        notebooks = response;
      } else if (response && response.data && Array.isArray(response.data)) {
        notebooks = response.data;
      }
      
      return notebooks.map((notebook: any) => ({
        uri: `siyuan://notebook/${notebook.id}`,
        name: notebook.name || 'Unnamed Notebook',
        description: `笔记本: ${notebook.name || 'Unnamed Notebook'}`,
        mimeType: 'application/x-siyuan-notebook',
        metadata: {
          type: 'notebook',
          id: notebook.id,
          icon: notebook.icon,
          sort: notebook.sort,
          closed: notebook.closed
        }
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to discover notebooks');
      return [];
    }
  }

  // 发现文档资源
  private async discoverDocuments(
    filter: ResourceFilter,
    pagination: PaginationOptions
  ): Promise<{ resources: MCPResource[]; total: number }> {
    try {
      const resources: MCPResource[] = [];
      let total = 0;

      if (filter.notebook) {
        // 获取指定笔记本的文档
        const docsResponse = await this.siyuanClient.documents.listDocs(
          filter.notebook
        );
        const docs = docsResponse.data || [];
        
        for (const doc of docs) {
          resources.push({
            uri: `siyuan://document/${doc.id}`,
            name: doc.name,
            description: `文档: ${doc.path}`,
            mimeType: 'application/x-siyuan-document',
            metadata: {
              type: 'document',
              id: doc.id,
              path: doc.path,
              notebook: filter.notebook,
              created: doc.created,
              updated: doc.updated,
              size: doc.size
            }
          });
        }
        total = docs.length;
      } else {
        // 获取所有笔记本的文档
        const notebooksResponse = await this.siyuanClient.request('/api/notebook/lsNotebooks', {});
        const notebooks = notebooksResponse.data?.notebooks || [];
        
        for (const notebook of notebooks) {
          const docsResponse = await this.siyuanClient.documents.listDocs(notebook.id);
        const docs = docsResponse.data || [];
          
          for (const doc of docs) {
            resources.push({
              uri: `siyuan://document/${doc.id}`,
              name: doc.name,
              description: `文档: ${doc.path} (${notebook.name})`,
              mimeType: 'application/x-siyuan-document',
              metadata: {
                type: 'document',
                id: doc.id,
                path: doc.path,
                notebook: notebook.id,
                notebookName: notebook.name,
                created: doc.created,
                updated: doc.updated,
                size: doc.size
              }
            });
          }
          total += docs.length;
        }
      }

      return { resources, total };
    } catch (error) {
      logger.error({ error, filter }, 'Failed to discover documents');
      return { resources: [], total: 0 };
    }
  }

  // 发现块资源
  private async discoverBlocks(
    filter: ResourceFilter,
    pagination: PaginationOptions
  ): Promise<{ resources: MCPResource[]; total: number }> {
    try {
      const resources: MCPResource[] = [];
      
      if (filter.query) {
        try {
          // 使用搜索API查找块
          const searchResponse = await this.siyuanClient.searchNotes(
            filter.query,
            pagination.limit || 20
          );
          
          // 处理搜索响应的不同格式
          let searchResults = [];
          if (searchResponse && searchResponse.data && searchResponse.data.blocks) {
            searchResults = searchResponse.data.blocks;
          } else if (Array.isArray(searchResponse)) {
            searchResults = searchResponse;
          } else if (searchResponse && Array.isArray(searchResponse.blocks)) {
            searchResults = searchResponse.blocks;
          }
          
          for (const result of searchResults) {
            resources.push({
              uri: `siyuan://block/${result.id}`,
              name: (result.content || result.markdown || '').substring(0, 100) + '...' || 'Untitled Block',
              description: `块: ${result.type || 'block'} - ${(result.content || result.markdown || '').substring(0, 200)}...`,
              mimeType: 'application/x-siyuan-block',
              metadata: {
                type: 'block',
                id: result.id,
                blockType: result.type,
                content: result.content || result.markdown,
                path: result.path,
                created: result.created,
                updated: result.updated
              }
            });
          }
          
          return { resources, total: searchResults.length };
        } catch (error) {
          // 完全禁用日志输出 - 用户不需要任何日志
          return { resources: [], total: 0 };
        }
      }

      return { resources: [], total: 0 };
    } catch (error) {
      logger.error({ error, filter }, 'Failed to discover blocks');
      return { resources: [], total: 0 };
    }
  }

  // 获取单个资源内容
  async getResourceContent(uri: string): Promise<string> {
    try {
      const { type, id } = this.parseResourceURI(uri);
      
      switch (type) {
        case 'notebook':
          const notebooksResponse = await this.siyuanClient.request('/api/notebook/lsNotebooks', {});
          const notebooks = notebooksResponse.data?.notebooks || [];
          const notebook = notebooks.find((nb: any) => nb.id === id);
          return JSON.stringify(notebook, null, 2);
          
        case 'document':
          // 获取文档的所有块
          const docBlocks = await this.siyuanClient.request('/api/filetree/getDoc', { id });
          // 处理思源API响应格式
          const data = docBlocks?.data || docBlocks;
          return JSON.stringify(data, null, 2);
          
        case 'block':
          const block = await this.siyuanClient.blocks.getBlock(id);
          return block?.content || '';
          
        default:
          throw new Error(`Unsupported resource type: ${type}`);
      }
    } catch (error) {
      logger.error({ error, uri }, 'Failed to get resource content');
      throw error;
    }
  }

  // 搜索资源
  async searchResources(
    query: string,
    filter: ResourceFilter = {},
    pagination: PaginationOptions = {}
  ): Promise<ResourceDiscoveryResult> {
    const searchFilter = { ...filter, query };
    return await this.discoverResources(searchFilter, pagination);
  }

  // 获取资源元数据
  async getResourceMetadata(uri: string): Promise<Record<string, any>> {
    try {
      const { type, id } = this.parseResourceURI(uri);
      
      switch (type) {
        case 'notebook':
          const notebooksResponse = await this.siyuanClient.request('/api/notebook/lsNotebooks', {});
          const notebooks = notebooksResponse.data?.notebooks || [];
          const notebook = notebooks.find((nb: any) => nb.id === id);
          return notebook || {};
          
        case 'document':
          const docInfo = await this.siyuanClient.request('/api/filetree/getDoc', { id });
          // 处理思源API响应格式
          return docInfo?.data || docInfo || {};
          
        case 'block':
          const block = await this.siyuanClient.blocks.getBlock(id);
          return block || {};
          
        default:
          return {};
      }
    } catch (error) {
      logger.error({ error, uri }, 'Failed to get resource metadata');
      return {};
    }
  }

  // 解析资源URI
  private parseResourceURI(uri: string): { type: string; id: string } {
    const match = uri.match(/^siyuan:\/\/(\w+)\/(.+)$/);
    if (!match) {
      throw new Error(`Invalid resource URI: ${uri}`);
    }
    
    return {
      type: match[1],
      id: match[2]
    };
  }

  // 排序资源
  private sortResources(
    resources: MCPResource[],
    sortBy: string,
    sortOrder: 'asc' | 'desc'
  ): MCPResource[] {
    return resources.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'created':
          const aCreated = a.metadata?.created || 0;
          const bCreated = b.metadata?.created || 0;
          comparison = aCreated - bCreated;
          break;
        case 'updated':
          const aUpdated = a.metadata?.updated || 0;
          const bUpdated = b.metadata?.updated || 0;
          comparison = aUpdated - bUpdated;
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  // 获取资源统计信息
  async getResourceStats(): Promise<{
    notebooks: number;
    documents: number;
    blocks: number;
    totalSize: number;
  }> {
    try {
      const notebooksResponse = await this.siyuanClient.request('/api/notebook/lsNotebooks', {});
      const notebooks = notebooksResponse.data?.notebooks || [];
      let documents = 0;
      let totalSize = 0;

      for (const notebook of notebooks) {
        const docsResponse = await this.siyuanClient.documents.listDocs(notebook.id);
        const docs = docsResponse.data || [];
        documents += docs.length;
        totalSize += docs.reduce((sum: number, doc: any) => sum + (doc.size || 0), 0);
      }

      return {
        notebooks: notebooks.length,
        documents,
        blocks: 0, // 块数量需要通过搜索API获取，这里暂时设为0
        totalSize
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get resource stats');
      return { notebooks: 0, documents: 0, blocks: 0, totalSize: 0 };
    }
  }
}

// 创建默认的资源目录实例
export const resourceDirectory = new ResourceDirectory();

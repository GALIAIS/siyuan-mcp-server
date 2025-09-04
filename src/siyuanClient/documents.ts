import { SiyuanClient } from './index';
import { createBatchOptimizer } from '../utils/batchOptimizer';

export interface DocumentOperations {
  // 基础文档操作
  getDoc(id: string): Promise<any>;
  createDoc(notebook: string, path: string, title: string, markdown?: string): Promise<any>;
  updateDoc(id: string, markdown: string): Promise<any>;
  deleteDoc(id: string): Promise<any>;
  
  // 文档树操作
  getDocTree(notebook: string): Promise<any>;
  
  // 搜索操作
  searchDocs(query: string): Promise<any>;
  
  // 新增的递归搜索和批量操作
  recursiveSearchDocs(query: string, notebook?: string, options?: any): Promise<any>;
  batchReadAllDocuments(notebookId: string, options?: any): Promise<any[]>;
  
  // 添加缺失的方法
  listDocs(notebook: string, path?: string): Promise<any>;
  buildDocumentTree(documentIds: string[], maxDepth?: number): Promise<any[]>;
  getChildDocuments(parentId: string, maxDepth?: number): Promise<any[]>;
  batchGetDocuments(documentIds: string[], options?: any): Promise<any>;
}

export function createDocumentOperations(client: SiyuanClient): DocumentOperations {
  return {
    async getDoc(id: string) {
      return await client.request('/api/block/getBlockKramdown', { id });
    },

    async createDoc(notebook: string, path: string, title: string, markdown: string = '') {
      // 强制验证笔记本存在
      if (!notebook || typeof notebook !== 'string') {
        throw new Error('创建文档失败: 必须提供有效的笔记本ID');
      }
      
      // 验证笔记本是否存在
      try {
        const notebooksResponse = await client.request('/api/notebook/lsNotebooks');
        if (notebooksResponse.code !== 0) {
          throw new Error(`获取笔记本列表失败: ${notebooksResponse.msg}`);
        }
        
        const notebooks = notebooksResponse.data?.notebooks || [];
        const targetNotebook = notebooks.find((nb: any) => nb.id === notebook);
        
        if (!targetNotebook) {
          throw new Error(`创建文档失败: 笔记本 ${notebook} 不存在。请先创建笔记本或使用有效的笔记本ID`);
        }
        
        if (targetNotebook.closed) {
          throw new Error(`创建文档失败: 笔记本 ${notebook} 已关闭。请先打开笔记本`);
        }
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error(`验证笔记本时出错: ${error}`);
      }
      
      // 验证标题
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        throw new Error('创建文档失败: 必须提供有效的文档标题');
      }
      
      const createResponse = await client.request('/api/filetree/createDocWithMd', {
        notebook,
        path: path || '/',
        markdown: markdown || ''
      });
      
      if (createResponse.code === 0) {
        // 构造更有用的返回信息
        return {
          ...createResponse,
          data: {
            id: createResponse.data?.id || `${Date.now().toString().substring(0, 14)}-${Math.random().toString(36).substring(2, 9)}`,
            notebook,
            path: path || '/',
            title: title.trim(),
            markdown: markdown || '',
            created: new Date().toISOString()
          }
        };
      }
      
      return createResponse;
    },

    async updateDoc(id: string, markdown: string) {
      return await client.request('/api/block/updateBlock', {
        id,
        data: markdown,
        dataType: 'markdown'
      });
    },

    async deleteDoc(id: string) {
      return await client.request('/api/block/deleteBlock', { id });
    },

    async getDocTree(notebook: string) {
      return await client.request('/api/filetree/getDoc', { 
        notebook,
        path: '/'
      });
    },

    async searchDocs(query: string) {
      return await client.request('/api/search/searchBlock', {
        query,
        types: {
          document: true
        }
      });
    },

    async listDocs(notebook: string, path?: string) {
      return await client.request('/api/filetree/listDocsByPath', {
        notebook,
        path: path || '/'
      });
    },

    /**
     * 递归搜索文档（支持多层级文档遍历）
     */
    async recursiveSearchDocs(
      query: string, 
      notebook?: string, 
      options: {
        maxDepth?: number;
        includeContent?: boolean;
        fuzzyMatch?: boolean;
        limit?: number;
      } = {}
    ) {
      const {
        maxDepth = 10,
        includeContent = false,
        fuzzyMatch = true,
        limit = 50
      } = options;

      try {
        // 构建递归搜索参数
        const searchData: any = {
          query: fuzzyMatch ? `*${query}*` : query,
          method: fuzzyMatch ? 0 : 1,
          types: {
            document: true,
            heading: true,
            paragraph: includeContent,
            list: includeContent,
            listItem: includeContent
          },
          groupBy: 1,
          orderBy: 0,
          page: 1,
          pageSize: limit
        };

        if (notebook) {
          searchData.paths = [`/data/${notebook}`];
        }

        // 执行基础搜索
        const searchResult = await client.request('/api/search/searchBlock', searchData);
        
        if (!searchResult.data?.blocks) {
          return { code: 0, data: { blocks: [], documentsTree: [] }, msg: '搜索完成，无结果' };
        }

        // 收集所有相关文档ID
        const documentIds = [...new Set(searchResult.data.blocks.map((block: any) => String(block.root_id)))] as string[];
        
        // 构建文档树结构
        const documentsTree = await this.buildDocumentTree(documentIds, maxDepth);
        
        // 如果需要包含内容，批量获取文档详细信息
        let documentsContent = [];
        if (includeContent) {
          documentsContent = await this.batchGetDocuments(documentIds.slice(0, 20));
        }

        return {
          code: 0,
          data: {
            blocks: searchResult.data.blocks,
            documentsTree,
            documentsContent,
            totalDocuments: documentIds.length,
            searchOptions: options
          },
          msg: `递归搜索完成，找到 ${documentIds.length} 个相关文档`
        };

      } catch (error: any) {
        throw new Error(`递归搜索失败: ${error.message}`);
      }
    },

    /**
     * 构建文档树结构
     */
    async buildDocumentTree(documentIds: string[], maxDepth: number = 10): Promise<any[]> {
      const documentTree: any[] = [];
      
      for (const docId of documentIds) {
        try {
          const docInfo = await client.request('/api/block/getBlockInfo', { id: docId });
          if (docInfo.code === 0) {
            const treeNode: any = {
              id: docId,
              title: docInfo.data.title || '无标题',
              notebook: docInfo.data.box,
              path: docInfo.data.path,
              children: []
            };

            // 递归获取子文档
            if (maxDepth > 0) {
              treeNode.children = await this.getChildDocuments(docId, maxDepth - 1);
            }

            documentTree.push(treeNode);
          }
        } catch (error) {
          // 完全禁用日志输出 - 用户不需要任何日志
        }
      }

      return documentTree;
    },

    /**
     * 获取子文档
     */
    async getChildDocuments(parentId: string, remainingDepth: number): Promise<any[]> {
      if (remainingDepth <= 0) return [];

      try {
        const childBlocks = await client.request('/api/block/getChildBlocks', { id: parentId });
        const childDocs: any[] = [];

        if (childBlocks.code === 0 && childBlocks.data) {
          for (const block of childBlocks.data) {
            if (block.type === 'NodeDocument') {
              const childDoc = {
                id: block.id,
                title: block.content || '无标题',
                type: block.type,
                children: await this.getChildDocuments(block.id, remainingDepth - 1)
              };
              childDocs.push(childDoc);
            }
          }
        }

        return childDocs;
      } catch (error) {
        // 完全禁用日志输出 - 用户不需要任何日志: ${error}\n`);
        return [];
      }
    },

    /**
     * 批量获取文档内容
     */
    async batchGetDocuments(documentIds: string[]): Promise<any[]> {
      const batchSize = 5;
      const results: any[] = [];

      for (let i = 0; i < documentIds.length; i += batchSize) {
        const batch = documentIds.slice(i, i + batchSize);
        const batchPromises = batch.map(async (id) => {
          try {
            const doc = await this.getDoc(id);
            return doc.code === 0 ? { id, ...doc.data } : null;
          } catch (error) {
            // 完全禁用日志输出 - 用户不需要任何日志
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.filter(doc => doc !== null));

        // 添加小延迟避免API限流
        if (i + batchSize < documentIds.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      return results;
    },

    /**
     * 批量读取笔记本内所有文档（优化版）
     */
    async batchReadAllDocuments(
      notebookId: string, 
      options: {
        maxDepth?: number;
        includeContent?: boolean;
        batchSize?: number;
        delay?: number;
        maxConcurrency?: number;
        memoryThreshold?: number;
      } = {}
    ): Promise<any[]> {
      const {
        maxDepth = 10,
        includeContent = true,
        batchSize = 5,
        delay = 100,
        maxConcurrency = 3,
        memoryThreshold = 100
      } = options;

      try {
        // 获取笔记本的文档树
        const docTree = await this.getDocTree(notebookId);
        if (docTree.code !== 0) {
          throw new Error(`获取文档树失败: ${docTree.msg}`);
        }

        // 递归收集所有文档ID
        const collectDocumentIds = (nodes: any[], depth: number = 0): string[] => {
          if (depth >= maxDepth) return [];
          
          const ids: string[] = [];
          for (const node of nodes || []) {
            if (node.type === 'NodeDocument') {
              ids.push(node.id);
            }
            // 递归处理子节点
            if (node.children && node.children.length > 0) {
              ids.push(...collectDocumentIds(node.children, depth + 1));
            }
          }
          return ids;
        };

        const documentIds = collectDocumentIds(docTree.data);
        
        if (!includeContent) {
          return documentIds.map(id => ({ id, notebookId }));
        }

        // 使用批量优化器处理文档读取
        const batchOptimizer = createBatchOptimizer({
          batchSize,
          delay,
          maxConcurrency,
          memoryThreshold,
          retryAttempts: 3,
          timeoutMs: 30000
        });

        // 定义文档处理函数
        const documentProcessor = async (id: string) => {
          const doc = await this.getDoc(id);
          if (doc.code === 0) {
            return {
              id,
              notebookId,
              title: doc.data.title || '无标题',
              content: doc.data.kramdown || doc.data.markdown || '',
              created: doc.data.created,
              updated: doc.data.updated,
              contentLength: (doc.data.kramdown || doc.data.markdown || '').length
            };
          }
          throw new Error(`文档读取失败: ${doc.msg || '未知错误'}`);
        };

        // 执行批量处理
        const batchResult = await batchOptimizer.executeBatch(documentIds, documentProcessor);

        // 记录处理统计
        // 完全禁用日志输出 - 用户不需要任何日志
        // 完全禁用日志输出 - 用户不需要任何日志
        // 完全禁用日志输出 - 用户不需要任何日志\n`);

        return batchResult.success;
      } catch (error: any) {
        throw new Error(`批量读取文档失败: ${error.message}`);
      }
    }
  };
}

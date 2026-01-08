import { SiyuanClient } from './index';

export interface BlockOperations {
  // 块基础操作
  getBlock(id: string): Promise<any>;
  updateBlock(id: string, content: string): Promise<any>;
  insertBlock(content: string, parentID?: string, previousID?: string): Promise<any>;
  deleteBlock(id: string): Promise<any>;
  moveBlock(id: string, parentID: string, previousID?: string): Promise<any>;

  // 块插入操作
  prependBlock(data: string, parentID: string, dataType?: string): Promise<any>;
  appendBlock(data: string, parentID: string, dataType?: string): Promise<any>;

  // 块折叠操作
  foldBlock(id: string): Promise<any>;
  unfoldBlock(id: string): Promise<any>;

  // 块引用操作
  transferBlockRef(id: string, targetID: string): Promise<any>;

  // 块查询操作
  getBlocksByType(type: string, limit?: number): Promise<any>;
  getChildBlocks(parentID: string): Promise<any>;
  getBlockBreadcrumb(id: string): Promise<any>;
}

export function createBlockOperations(client: SiyuanClient): BlockOperations {
  return {
    async getBlock(id: string) {
      return await client.request('/api/block/getBlockKramdown', { id });
    },

    async updateBlock(id: string, content: string) {
      return await client.request('/api/block/updateBlock', {
        id,
        data: content,
        dataType: 'markdown'
      });
    },

    async insertBlock(content: string, parentID?: string, previousID?: string) {
      return await client.request('/api/block/insertBlock', {
        data: content,
        dataType: 'markdown',
        parentID,
        previousID
      });
    },

    async deleteBlock(id: string) {
      return await client.request('/api/block/deleteBlock', { id });
    },

    async moveBlock(id: string, parentID: string, previousID?: string) {
      return await client.request('/api/block/moveBlock', {
        id,
        parentID,
        previousID
      });
    },

    async prependBlock(data: string, parentID: string, dataType = 'markdown') {
      return await client.request('/api/block/prependBlock', {
        data,
        dataType,
        parentID
      });
    },

    async appendBlock(data: string, parentID: string, dataType = 'markdown') {
      return await client.request('/api/block/appendBlock', {
        data,
        dataType,
        parentID
      });
    },

    async foldBlock(id: string) {
      return await client.request('/api/block/foldBlock', { id });
    },

    async unfoldBlock(id: string) {
      return await client.request('/api/block/unfoldBlock', { id });
    },

    async transferBlockRef(id: string, targetID: string) {
      return await client.request('/api/block/transferBlockRef', {
        id,
        targetID
      });
    },

    async getBlocksByType(type: string, limit = 50) {
      return await client.request('/api/search/searchBlock', {
        query: '',
        types: { [type]: true },
        method: 0,
        orderBy: 0,
        groupBy: 0,
        page: 1,
        pageSize: limit
      });
    },

    async getChildBlocks(parentID: string) {
      return await client.request('/api/block/getChildBlocks', { id: parentID });
    },

    async getBlockBreadcrumb(id: string) {
      return await client.request('/api/block/getBlockBreadcrumb', { id });
    }
  };
}

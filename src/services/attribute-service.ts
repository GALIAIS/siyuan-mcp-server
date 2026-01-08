/**
 * 属性管理服务
 * 提供块的属性设置和获取功能
 *
 * @author CodeBuddy
 * @since 1.0.0
 */

import { SiyuanClient } from '../siyuanClient';

export interface BlockAttributes {
  [key: string]: string;
}

export interface SetBlockAttrsResponse {
  code: number;
  msg: string;
  data: null;
}

export interface GetBlockAttrsResponse {
  code: number;
  msg: string;
  data: {
    id: string;
    attrs: Record<string, string>;
  };
}

export class AttributeService {
  private client: SiyuanClient;

  constructor(client: SiyuanClient) {
    this.client = client;
  }

  /**
   * 设置块属性
   *
   * @param id - 块ID
   * @param attrs - 属性对象
   * @returns {Promise<SetBlockAttrsResponse>} 设置结果
   *
   * @example
   * ```typescript
   * const attrService = new AttributeService(client);
   * await attrService.setBlockAttrs('20230101000000', {
   *   'custom-attr': 'value',
   *   'memo': '这是一个备注'
   * });
   * ```
   */
  async setBlockAttrs(id: string, attrs: BlockAttributes): Promise<SetBlockAttrsResponse> {
    return await this.client.request('/api/attr/setBlockAttrs', {
      id,
      attrs
    });
  }

  /**
   * 获取块属性
   *
   * @param id - 块ID
   * @returns {Promise<GetBlockAttrsResponse>} 包含属性的响应
   *
   * @example
   * ```typescript
   * const attrService = new AttributeService(client);
   * const response = await attrService.getBlockAttrs('20230101000000');
   * console.log('块属性:', response.data.attrs);
   * ```
   */
  async getBlockAttrs(id: string): Promise<GetBlockAttrsResponse> {
    return await this.client.request('/api/attr/getBlockAttrs', { id });
  }

  /**
   * 批量设置块属性
   *
   * @param attrsMap - 块ID到属性的映射
   * @returns {Promise<Map<string, boolean>>} 每个块ID的设置结果
   */
  async batchSetBlockAttrs(attrsMap: Record<string, BlockAttributes>): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [id, attrs] of Object.entries(attrsMap)) {
      try {
        await this.setBlockAttrs(id, attrs);
        results.set(id, true);
      } catch (error) {
        console.error(`设置块 ${id} 属性失败:`, error);
        results.set(id, false);
      }
    }

    return results;
  }

  /**
   * 批量获取块属性
   *
   * @param ids - 块ID数组
   * @returns {Promise<Map<string, BlockAttributes>>} 每个块ID的属性
   */
  async batchGetBlockAttrs(ids: string[]): Promise<Map<string, BlockAttributes>> {
    const results = new Map<string, BlockAttributes>();

    for (const id of ids) {
      try {
        const response = await this.getBlockAttrs(id);
        if (response.code === 0 && response.data) {
          results.set(id, response.data.attrs);
        }
      } catch (error) {
        console.error(`获取块 ${id} 属性失败:`, error);
        results.set(id, {});
      }
    }

    return results;
  }

  /**
   * 删除块的所有自定义属性（保留系统属性）
   *
   * @param id - 块ID
   * @param preserveSystemAttrs - 是否保留系统属性（默认保留）
   * @returns {Promise<boolean>} 操作是否成功
   */
  async clearBlockAttrs(id: string, preserveSystemAttrs = true): Promise<boolean> {
    try {
      const currentAttrs = await this.getBlockAttrs(id);

      if (currentAttrs.code !== 0 || !currentAttrs.data) {
        return false;
      }

      const attrs = currentAttrs.data.attrs;
      const systemAttrs = ['id', 'type', 'subtype', 'markdown', 'updated', 'created'];

      const attrsToDelete: BlockAttributes = {};

      for (const key of Object.keys(attrs)) {
        if (!preserveSystemAttrs || !systemAttrs.includes(key)) {
          attrsToDelete[key] = '';
        }
      }

      if (Object.keys(attrsToDelete).length > 0) {
        const response = await this.setBlockAttrs(id, attrsToDelete);
        return response.code === 0;
      }

      return true;
    } catch (error) {
      console.error(`清除块 ${id} 属性失败:`, error);
      return false;
    }
  }

  /**
   * 复制块属性到另一个块
   *
   * @param sourceId - 源块ID
   * @param targetId - 目标块ID
   * @param overwrite - 是否覆盖目标块现有属性
   * @returns {Promise<boolean>} 操作是否成功
   */
  async copyBlockAttrs(
    sourceId: string,
    targetId: string,
    overwrite = false
  ): Promise<boolean> {
    try {
      const sourceAttrs = await this.getBlockAttrs(sourceId);

      if (sourceAttrs.code !== 0 || !sourceAttrs.data) {
        return false;
      }

      if (overwrite) {
        const response = await this.setBlockAttrs(targetId, sourceAttrs.data.attrs);
        return response.code === 0;
      } else {
        const targetAttrs = await this.getBlockAttrs(targetId);

        if (targetAttrs.code !== 0 || !targetAttrs.data) {
          return false;
        }

        const mergedAttrs = {
          ...targetAttrs.data.attrs,
          ...sourceAttrs.data.attrs
        };

        const response = await this.setBlockAttrs(targetId, mergedAttrs);
        return response.code === 0;
      }
    } catch (error) {
      console.error(`复制块属性失败:`, error);
      return false;
    }
  }
}

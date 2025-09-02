/**
 * 思源笔记客户端
 * 统一的API客户端，整合所有思源笔记API调用
 * 
 * @author CodeBuddy
 * @since 1.0.0
 */

import { createBlockOperations, BlockOperations } from './blocks';
import { createDocumentOperations, DocumentOperations } from './documents';
import { createAssetOperations, AssetOperations } from './assets';

export interface SiyuanClientConfig {
  baseURL: string;
  token?: string;
  timeout?: number;
}

export interface SiyuanResponse<T = any> {
  code: number;
  msg: string;
  data: T;
}

export class SiyuanClient {
  private config: SiyuanClientConfig;

  constructor(config: SiyuanClientConfig) {
    this.config = config;
  }

  /**
   * 执行SQL查询
   * @param params - SQL查询参数
   * @returns 查询结果
   */
  async sql(params: { stmt: string }): Promise<SiyuanResponse> {
    return this.request('/api/query/sql', params);
  }

  /**
   * 根据ID获取块
   * @param params - 查询参数
   * @returns 块信息
   */
  async getBlockByID(params: { id: string }): Promise<SiyuanResponse> {
    const blockOps = createBlockOperations(this as any);
    return blockOps.getBlock(params.id);
  }

  /**
   * 插入块
   * @param params - 插入参数
   * @returns 插入结果
   */
  async insertBlock(params: {
    dataType: string;
    data: string;
    parentID: string;
    previousID?: string;
  }): Promise<SiyuanResponse> {
    const blockOps = createBlockOperations(this as any);
    return blockOps.insertBlock(params.data, params.parentID, params.previousID);
  }

  /**
   * 更新块
   * @param params - 更新参数
   * @returns 更新结果
   */
  async updateBlock(params: {
    id: string;
    data: string;
    dataType?: string;
  }): Promise<SiyuanResponse> {
    const blockOps = createBlockOperations(this as any);
    return blockOps.updateBlock(params.id, params.data);
  }

  /**
   * 删除块
   * @param params - 删除参数
   * @returns 删除结果
   */
  async deleteBlock(params: { id: string }): Promise<SiyuanResponse> {
    const blockOps = createBlockOperations(this as any);
    return blockOps.deleteBlock(params.id);
  }

  /**
   * 通用请求方法
   * @param endpoint - API端点
   * @param data - 请求数据
   * @returns 响应结果
   */
  private async request(endpoint: string, data: any): Promise<SiyuanResponse> {
    try {
      const response = await fetch(`${this.config.baseURL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.config.token ? `Token ${this.config.token}` : ''
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`请求失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
}
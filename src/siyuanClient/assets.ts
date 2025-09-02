import { SiyuanClient } from './index';

export interface AssetOperations {
  // 资源上传
  uploadAsset(file: Buffer | Uint8Array, filename: string, assetsDirPath?: string): Promise<any>;
  uploadCloud(file: Buffer | Uint8Array, filename: string): Promise<any>;
  
  // 资源管理
  resolveAssetPath(path: string): Promise<any>;
  getDocAssets(id: string): Promise<any>;
  getDocImageAssets(id: string): Promise<any>;
  getUnusedAssets(): Promise<any>;
  getMissingAssets(): Promise<any>;
  removeUnusedAsset(path: string): Promise<any>;
  removeUnusedAssets(): Promise<any>;
  renameAsset(oldPath: string, newPath: string): Promise<any>;
  
  // 文件注释
  setFileAnnotation(path: string, annotation: string): Promise<any>;
  getFileAnnotation(path: string): Promise<any>;
  
  // OCR 功能
  getImageOCRText(path: string): Promise<any>;
  setImageOCRText(path: string, text: string): Promise<any>;
  ocr(path: string): Promise<any>;
  
  // 资源统计
  statAsset(path: string): Promise<any>;
  fullReindexAssetContent(): Promise<any>;
}

export function createAssetOperations(client: SiyuanClient): AssetOperations {
  return {
    async uploadAsset(file: Buffer | Uint8Array, filename: string, assetsDirPath = '/assets/') {
      // 注意：实际的文件上传需要在客户端实现 FormData
      // 这里提供基础的上传接口结构
      return await client.request('/api/asset/upload', {
        filename,
        assetsDirPath,
        // 实际使用时需要处理文件数据
        note: 'File upload requires FormData implementation'
      });
    },

    async uploadCloud(file: Buffer | Uint8Array, filename: string) {
      return await client.request('/api/asset/uploadCloud', {
        filename,
        note: 'Cloud upload requires FormData implementation'
      });
    },

    async resolveAssetPath(path: string) {
      return await client.request('/api/asset/resolveAssetPath', { path });
    },

    async getDocAssets(id: string) {
      return await client.request('/api/asset/getDocAssets', { id });
    },

    async getDocImageAssets(id: string) {
      return await client.request('/api/asset/getDocImageAssets', { id });
    },

    async getUnusedAssets() {
      return await client.request('/api/asset/getUnusedAssets');
    },

    async getMissingAssets() {
      return await client.request('/api/asset/getMissingAssets');
    },

    async removeUnusedAsset(path: string) {
      return await client.request('/api/asset/removeUnusedAsset', { path });
    },

    async removeUnusedAssets() {
      return await client.request('/api/asset/removeUnusedAssets');
    },

    async renameAsset(oldPath: string, newPath: string) {
      return await client.request('/api/asset/renameAsset', { 
        oldPath, 
        newPath 
      });
    },

    async setFileAnnotation(path: string, annotation: string) {
      return await client.request('/api/asset/setFileAnnotation', { 
        path, 
        annotation 
      });
    },

    async getFileAnnotation(path: string) {
      return await client.request('/api/asset/getFileAnnotation', { path });
    },

    async getImageOCRText(path: string) {
      return await client.request('/api/asset/getImageOCRText', { path });
    },

    async setImageOCRText(path: string, text: string) {
      return await client.request('/api/asset/setImageOCRText', { 
        path, 
        text 
      });
    },

    async ocr(path: string) {
      return await client.request('/api/asset/ocr', { path });
    },

    async statAsset(path: string) {
      return await client.request('/api/asset/statAsset', { path });
    },

    async fullReindexAssetContent() {
      return await client.request('/api/asset/fullReindexAssetContent');
    }
  };
}
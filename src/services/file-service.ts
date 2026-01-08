/**
 * 文件服务
 * 提供文件读写和管理功能
 *
 * @author CodeBuddy
 * @since 1.0.0
 */

import { SiyuanClient } from '../siyuanClient';

export interface FileReadRequest {
  path: string;
}

export interface FileWriteRequest {
  path: string;
  file: Buffer | Uint8Array | string;
  isDir?: boolean;
  modTime?: number;
}

export interface FileRenameRequest {
  path: string;
  newPath: string;
}

export interface FileListRequest {
  path: string;
}

export interface FileEntry {
  isDir: boolean;
  isSymlink: boolean;
  name: string;
  updated: number;
}

export interface FileResponse {
  code: number;
  msg: string;
  data: any;
}

export interface FileListResponse {
  code: number;
  msg: string;
  data: FileEntry[];
}

export class FileService {
  private client: SiyuanClient;

  constructor(client: SiyuanClient) {
    this.client = client;
  }

  /**
   * 读取文件
   *
   * @param path - 文件路径（相对于工作空间）
   * @returns {Promise<FileResponse>} 文件内容
   *
   * @example
   * ```typescript
   * const fileService = new FileService(client);
   * const result = await fileService.readFile('/data/20210808180117-6v0mkxr/20200923234011-ieuun1p.sy');
   * ```
   */
  async readFile(path: string): Promise<FileResponse> {
    return await this.client.request('/api/file/getFile', { path });
  }

  /**
   * 读取文件内容并返回字符串
   *
   * @param path - 文件路径
   * @returns {Promise<string>} 文件内容字符串
   */
  async readFileAsString(path: string): Promise<string> {
    const response = await this.readFile(path);

    if (response.code !== 0) {
      throw new Error(response.msg || '读取文件失败');
    }

    return response.data;
  }

  /**
   * 写入文件
   *
   * @param path - 文件路径（相对于工作空间）
   * @param content - 文件内容
   * @param isDir - 是否创建目录
   * @param modTime - 修改时间（Unix时间戳）
   * @returns {Promise<FileResponse>} 操作结果
   *
   * @example
   * ```typescript
   * const fileService = new FileService(client);
   * const result = await fileService.writeFile('/data/test.txt', 'Hello World');
   * ```
   */
  async writeFile(
    path: string,
    content: Buffer | Uint8Array | string,
    isDir = false,
    modTime?: number
  ): Promise<FileResponse> {
    return await this.client.request('/api/file/putFile', {
      path,
      file: content,
      isDir,
      modTime: modTime || Math.floor(Date.now() / 1000)
    });
  }

  /**
   * 创建目录
   *
   * @param path - 目录路径
   * @returns {Promise<FileResponse>} 操作结果
   */
  async createDirectory(path: string): Promise<FileResponse> {
    return await this.writeFile(path, '', true);
  }

  /**
   * 删除文件或目录
   *
   * @param path - 文件或目录路径
   * @returns {Promise<FileResponse>} 操作结果
   *
   * @example
   * ```typescript
   * const fileService = new FileService(client);
   * const result = await fileService.removeFile('/data/test.txt');
   * ```
   */
  async removeFile(path: string): Promise<FileResponse> {
    return await this.client.request('/api/file/removeFile', { path });
  }

  /**
   * 重命名文件或目录
   *
   * @param path - 原始路径
   * @param newPath - 新路径
   * @returns {Promise<FileResponse>} 操作结果
   *
   * @example
   * ```typescript
   * const fileService = new FileService(client);
   * const result = await fileService.renameFile('/data/old.txt', '/data/new.txt');
   * ```
   */
  async renameFile(path: string, newPath: string): Promise<FileResponse> {
    return await this.client.request('/api/file/renameFile', { path, newPath });
  }

  /**
   * 列出目录内容
   *
   * @param path - 目录路径
   * @returns {Promise<FileListResponse>} 目录内容列表
   *
   * @example
   * ```typescript
   * const fileService = new FileService(client);
   * const result = await fileService.listFiles('/data/20210808180117-6v0mkxr');
   * console.log('目录内容:', result.data);
   * ```
   */
  async listFiles(path: string): Promise<FileListResponse> {
    return await this.client.request('/api/file/readDir', { path });
  }

  /**
   * 获取目录中的文件和文件夹列表
   *
   * @param path - 目录路径
   * @returns {Promise<FileEntry[]>} 文件条目数组
   */
  async listFilesAsArray(path: string): Promise<FileEntry[]> {
    const response = await this.listFiles(path);

    if (response.code !== 0) {
      throw new Error(response.msg || '列出文件失败');
    }

    return response.data || [];
  }

  /**
   * 检查路径是否存在
   *
   * @param path - 路径
   * @returns {Promise<boolean>} 是否存在
   */
  async exists(path: string): Promise<boolean> {
    try {
      await this.listFiles(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 递归列出目录内容
   *
   * @param path - 起始目录路径
   * @param depth - 最大深度
   * @returns {Promise<FileEntry[]>} 所有文件和目录
   */
  async listFilesRecursive(
    path: string,
    depth = 10
  ): Promise<FileEntry[]> {
    const results: FileEntry[] = [];
    const queue: { path: string; currentDepth: number }[] = [
      { path, currentDepth: 0 }
    ];

    while (queue.length > 0) {
      const { path: currentPath, currentDepth } = queue.shift()!;

      if (currentDepth > depth) {
        continue;
      }

      try {
        const entries = await this.listFilesAsArray(currentPath);
        results.push(...entries);

        for (const entry of entries) {
          if (entry.isDir) {
            const fullPath = `${currentPath}/${entry.name}`.replace(
              '//',
              '/'
            );
            queue.push({ path: fullPath, currentDepth: currentDepth + 1 });
          }
        }
      } catch (error) {
        console.error(`无法列出目录 ${currentPath}:`, error);
      }
    }

    return results;
  }

  /**
   * 复制文件
   *
   * @param sourcePath - 源路径
   * @param destPath - 目标路径
   * @returns {Promise<FileResponse>} 操作结果
   */
  async copyFile(sourcePath: string, destPath: string): Promise<FileResponse> {
    const content = await this.readFileAsString(sourcePath);
    return await this.writeFile(destPath, content);
  }

  /**
   * 移动文件
   *
   * @param sourcePath - 源路径
   * @param destPath - 目标路径
   * @returns {Promise<FileResponse>} 操作结果
   */
  async moveFile(sourcePath: string, destPath: string): Promise<FileResponse> {
    return await this.renameFile(sourcePath, destPath);
  }

  /**
   * 获取文件信息
   *
   * @param path - 文件路径
   * @returns {Promise<FileEntry | null>} 文件信息
   */
  async getFileInfo(path: string): Promise<FileEntry | null> {
    const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
    const fileName = path.substring(path.lastIndexOf('/') + 1);

    const entries = await this.listFilesAsArray(parentPath);
    return entries.find(entry => entry.name === fileName) || null;
  }

  /**
   * 创建临时文件
   *
   * @param content - 文件内容
   * @param prefix - 文件前缀
   * @returns {Promise<string>} 文件路径
   */
  async createTempFile(
    content: string,
    prefix = 'tmp-'
  ): Promise<string> {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const fileName = `${prefix}${timestamp}-${random}.txt`;
    const path = `/tmp/${fileName}`;

    await this.writeFile(path, content);
    return path;
  }
}

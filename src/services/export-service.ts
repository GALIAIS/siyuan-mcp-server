/**
 * 导出服务
 * 提供文档导出功能
 *
 * @author CodeBuddy
 * @since 1.0.0
 */

import { SiyuanClient } from '../siyuanClient';

export interface ExportMdRequest {
  id: string;
  notebook: string;
  path: string;
}

export interface ExportMdResponse {
  code: number;
  msg: string;
  data: {
    zip: string;
  };
}

export interface ExportFileRequest {
  id: string;
  notebook: string;
  path: string;
  type: string;
}

export interface ExportFileResponse {
  code: number;
  msg: string;
  data: {
    zip: string;
  };
}

export interface ExpandRequest {
  id: string;
  notebook: string;
  path: string;
}

export interface ExpandResponse {
  code: number;
  msg: string;
  data: {
    zip: string;
  };
}

export class ExportService {
  private client: SiyuanClient;

  constructor(client: SiyuanClient) {
    this.client = client;
  }

  /**
   * 导出为Markdown
   *
   * @param id - 文档ID
   * @param notebook - 笔记本ID
   * @param path - 文档路径
   * @returns {Promise<ExportMdResponse>} 包含ZIP文件base64编码的响应
   *
   * @example
   * ```typescript
   * const exportService = new ExportService(client);
   * const result = await exportService.exportMd(
   *   '20230101000000',
   *   '20230101000000',
   *   '/document.md'
   * );
   * console.log('导出文件:', result.data.zip);
   * ```
   */
  async exportMd(
    id: string,
    notebook: string,
    path: string
  ): Promise<ExportMdResponse> {
    return await this.client.request('/api/export/exportMd', {
      id,
      notebook,
      path
    });
  }

  /**
   * 导出文件
   *
   * @param id - 文档ID
   * @param notebook - 笔记本ID
   * @param path - 文档路径
   * @param type - 导出类型 (如 'pdf', 'word', 'html' 等)
   * @returns {Promise<ExportFileResponse>} 包含ZIP文件base64编码的响应
   *
   * @example
   * ```typescript
   * const exportService = new ExportService(client);
   * const result = await exportService.exportFile(
   *   '20230101000000',
   *   '20230101000000',
   *   '/document.md',
   *   'pdf'
   * );
   * console.log('导出文件:', result.data.zip);
   * ```
   */
  async exportFile(
    id: string,
    notebook: string,
    path: string,
    type: string
  ): Promise<ExportFileResponse> {
    return await this.client.request('/api/export/exportFile', {
      id,
      notebook,
      path,
      type
    });
  }

  /**
   * 导出展开（包含所有子文档）
   *
   * @param id - 文档ID
   * @param notebook - 笔记本ID
   * @param path - 文档路径
   * @returns {Promise<ExpandResponse>} 包含ZIP文件base64编码的响应
   *
   * @example
   * ```typescript
   * const exportService = new ExportService(client);
   * const result = await exportService.expand(
   *   '20230101000000',
   *   '20230101000000',
   *   '/document.md'
   * );
   * console.log('导出文件:', result.data.zip);
   * ```
   */
  async expand(
    id: string,
    notebook: string,
    path: string
  ): Promise<ExpandResponse> {
    return await this.client.request('/api/export/expand', {
      id,
      notebook,
      path
    });
  }

  /**
   * 导出为PDF
   *
   * @param id - 文档ID
   * @param notebook - 笔记本ID
   * @param path - 文档路径
   * @returns {Promise<string>} 导出文件的base64编码
   */
  async exportPdf(
    id: string,
    notebook: string,
    path: string
  ): Promise<string> {
    const response = await this.exportFile(id, notebook, path, 'pdf');

    if (response.code !== 0) {
      throw new Error(response.msg || 'PDF导出失败');
    }

    return response.data.zip;
  }

  /**
   * 导出为HTML
   *
   * @param id - 文档ID
   * @param notebook - 笔记本ID
   * @param path - 文档路径
   * @returns {Promise<string>} 导出文件的base64编码
   */
  async exportHtml(
    id: string,
    notebook: string,
    path: string
  ): Promise<string> {
    const response = await this.exportFile(id, notebook, path, 'html');

    if (response.code !== 0) {
      throw new Error(response.msg || 'HTML导出失败');
    }

    return response.data.zip;
  }

  /**
   * 导出为Word
   *
   * @param id - 文档ID
   * @param notebook - 笔记本ID
   * @param path - 文档路径
   * @returns {Promise<string>} 导出文件的base64编码
   */
  async exportWord(
    id: string,
    notebook: string,
    path: string
  ): Promise<string> {
    const response = await this.exportFile(id, notebook, path, 'word');

    if (response.code !== 0) {
      throw new Error(response.msg || 'Word导出失败');
    }

    return response.data.zip;
  }

  /**
   * 导出整个笔记本（包含所有文档）
   *
   * @param notebook - 笔记本ID
   * @returns {Promise<string>} 导出文件的base64编码
   */
  async exportNotebook(notebook: string): Promise<string> {
    const response = await this.client.request('/api/export/exportMd', {
      id: notebook,
      notebook,
      path: '/'
    });

    if (response.code !== 0) {
      throw new Error(response.msg || '笔记本导出失败');
    }

    return response.data.zip;
  }

  /**
   * 解码base64导出文件并保存到磁盘
   *
   * @param base64Zip - base64编码的ZIP文件
   * @param outputPath - 输出文件路径
   * @returns {Promise<string>} 保存的文件路径
   */
  async saveExportedFile(
    base64Zip: string,
    outputPath: string
  ): Promise<string> {
    try {
      const buffer = Buffer.from(base64Zip, 'base64');
      const fs = await import('fs');
      fs.writeFileSync(outputPath, buffer);
      return outputPath;
    } catch (error) {
      console.error('保存导出文件失败:', error);
      throw error;
    }
  }
}

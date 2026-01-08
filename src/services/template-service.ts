/**
 * 模板服务
 * 提供模板渲染功能
 *
 * @author CodeBuddy
 * @since 1.0.0
 */

import { SiyuanClient } from '../siyuanClient';

export interface RenderSprigRequest {
  id: string;
  sprig: string;
}

export interface RenderSprigResponse {
  code: number;
  msg: string;
  data: {
    content: string;
  };
}

export interface RenderRequest {
  id: string;
  content: string;
}

export interface RenderResponse {
  code: number;
  msg: string;
  data: {
    content: string;
  };
}

export class TemplateService {
  private client: SiyuanClient;

  constructor(client: SiyuanClient) {
    this.client = client;
  }

  /**
   * 渲染Sprig模板
   *
   * @param id - 模板ID
   * @param sprig - Sprig模板内容
   * @returns {Promise<RenderSprigResponse>} 渲染结果
   *
   * @example
   * ```typescript
   * const templateService = new TemplateService(client);
   * const result = await templateService.renderSprig(
   *   '20230101000000',
   *   '{{ now | date "2006-01-02" }}'
   * );
   * console.log('渲染结果:', result.data.content);
   * ```
   */
  async renderSprig(id: string, sprig: string): Promise<RenderSprigResponse> {
    return await this.client.request('/api/template/renderSprig', {
      id,
      sprig
    });
  }

  /**
   * 渲染模板
   *
   * @param id - 模板ID
   * @param content - 模板内容
   * @returns {Promise<RenderResponse>} 渲染结果
   *
   * @example
   * ```typescript
   * const templateService = new TemplateService(client);
   * const result = await templateService.render(
   *   '20230101000000',
   *   '# {{ .title }}\n\n{{ .content }}'
   * );
   * console.log('渲染结果:', result.data.content);
   * ```
   */
  async render(id: string, content: string): Promise<RenderResponse> {
    return await this.client.request('/api/template/render', {
      id,
      content
    });
  }

  /**
   * 使用变量渲染模板
   *
   * @param id - 模板ID
   * @param templateContent - 模板内容
   * @param variables - 变量映射
   * @returns {Promise<string>} 渲染后的内容
   */
  async renderWithVariables(
    id: string,
    templateContent: string,
    variables: Record<string, any>
  ): Promise<string> {
    try {
      const response = await this.render(id, templateContent);

      if (response.code !== 0) {
        throw new Error(response.msg || '模板渲染失败');
      }

      let content = response.data.content;

      for (const [key, value] of Object.entries(variables)) {
        const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        content = content.replace(placeholder, String(value));
      }

      return content;
    } catch (error) {
      console.error('模板渲染失败:', error);
      throw error;
    }
  }

  /**
   * 渲染Sprig模板并替换变量
   *
   * @param id - 模板ID
   * @param sprigTemplate - Sprig模板内容
   * @param context - 上下文数据
   * @returns {Promise<string>} 渲染后的内容
   */
  async renderSprigWithContext(
    id: string,
    sprigTemplate: string,
    context: Record<string, any>
  ): Promise<string> {
    try {
      const response = await this.renderSprig(id, sprigTemplate);

      if (response.code !== 0) {
        throw new Error(response.msg || 'Sprig模板渲染失败');
      }

      let content = response.data.content;

      const jsonContext = JSON.stringify(context);
      const jsonPlaceholder = new RegExp('\\{\\{json\\.context\\}\\}', 'g');
      content = content.replace(jsonPlaceholder, jsonContext);

      return content;
    } catch (error) {
      console.error('Sprig模板渲染失败:', error);
      throw error;
    }
  }

  /**
   * 创建模板内容
   *
   * @param title - 模板标题
   * @param content - 模板内容
   * @returns {Promise<string>} 模板ID
   */
  async createTemplate(
    notebook: string,
    path: string,
    title: string,
    content: string
  ): Promise<string> {
    try {
      const response = await this.client.request('/api/filetree/createDoc', {
        notebook,
        path,
        title: `templates/${title}`,
        markdown: content
      });

      if (response.code !== 0) {
        throw new Error(response.msg || '创建模板失败');
      }

      return response.data.id;
    } catch (error) {
      console.error('创建模板失败:', error);
      throw error;
    }
  }
}

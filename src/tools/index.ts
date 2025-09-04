/**
 * 数据读写工具集
 * TODO: 实现更多工具
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
}

const DATA_TOOLS: ToolDefinition[] = [
  {
    name: 'notes.read',
    description: '读取指定ID的笔记块',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '块ID'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'notes.create',
    description: '创建新的笔记块',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: '块内容（Markdown格式）'
        },
        parentID: {
          type: 'string',
          description: '父块ID（可选）'
        }
      },
      required: ['content']
    }
  },
  {
    name: 'notes.update',
    description: '更新指定ID的笔记块',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '块ID'
        },
        content: {
          type: 'string',
          description: '新的块内容（Markdown格式）'
        }
      },
      required: ['id', 'content']
    }
  },
  {
    name: 'notes.delete',
    description: '删除指定ID的笔记块',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '块ID'
        }
      },
      required: ['id']
    }
  }
];

# SiYuan MCP Server

一个为思源笔记（SiYuan）设计的 Model Context Protocol (MCP) 服务器，提供完整的 AI 集成和智能知识管理功能。

## 🌟 核心特性

### 笔记管理
- **笔记本操作**: 创建、列表、打开、关闭、重命名、删除笔记本
- **文档管理**: 创建、读取、更新、删除文档，支持批量操作
- **块操作**: 创建、读取、更新、删除笔记块，支持批量操作
- **块属性**: 设置和获取块属性，支持自定义属性管理

### 搜索功能
- **简单搜索**: 快速关键词搜索
- **递归搜索**: 深度内容挖掘，支持层级遍历
- **文档内搜索**: 在指定文档中精确查找
- **批量读取**: 高效批量读取多个文档

### 模板与渲染
- **模板渲染**: 支持标准模板语法
- **Sprig模板**: 支持Sprig函数库的高级模板功能
- **动态内容**: 基于模板生成格式化内容

### 导出功能
- **Markdown导出**: 导出为标准Markdown格式
- **多格式导出**: 支持PDF、Word、HTML等多种格式
- **树状结构导出**: 保留文档层级关系的JSON导出

### 资源管理
- **文件上传**: 上传图片、文档等资源文件
- **资源列表**: 列出文档中的所有资源
- **资源重命名**: 重命名资源文件
- **OCR识别**: 图片文字识别功能

### 数据操作
- **SQL查询**: 执行SQL查询，支持复杂的数据检索
- **文件操作**: 读取、写入、删除文件
- **文件列表**: 列出目录中的文件

### 系统工具
- **时间获取**: 获取当前真实时间，支持多种格式和时区
- **健康检查**: 系统健康状态监控
- **端口发现**: 自动发现思源笔记可用端口

### AI 智能集成
- **智能工具选择**: AI驱动的工具推荐和选择
- **使用场景指导**: 详细的工具使用场景和示例
- **性能优化建议**: 基于使用模式的优化建议
- **错误处理**: 标准化的错误处理和重试机制

### 性能优化
- **缓存机制**: 智能缓存提升响应速度
- **批量处理**: 高效的批量数据操作
- **性能监控**: 实时性能指标和统计
- **并发控制**: 合理的并发请求管理

## 🚀 快速开始

### 1. 安装思源笔记
1. 下载安装包：[https://github.com/siyuan-note/siyuan/releases](https://github.com/siyuan-note/siyuan/releases)
2. 启动思源笔记

### 2. 配置思源笔记
1. 启动思源笔记
2. 设置 → 关于 → API token
3. 复制API Token

### 3. 安装 MCP Server

#### 从 npm 安装
```bash
npm install -g siyuan-mcp-server
```

#### 从源码安装
```bash
git clone https://github.com/your-username/siyuan-mcp-server.git
cd siyuan-mcp-server
npm install
npm run build
npm link
```

### 4. 配置 MCP

在您的 MCP 客户端配置文件中添加：

```json
{
  "mcpServers": {
    "siyuan": {
      "command": "npx",
      "args": ["siyuan-mcp-server"],
      "env": {
        "SIYUAN_API_TOKEN": "your-api-token",
        "SIYUAN_API_URL": "http://127.0.0.1:6806"
      }
    }
  }
}
```

### 5. 环境变量

- `SIYUAN_API_TOKEN`: 思源笔记 API Token（必需）
- `SIYUAN_API_URL`: 思源笔记 API 地址（默认：http://127.0.0.1:6806）(可选,一般情况会自动获取)

## 🛠️ 技术栈

- **运行时**: Node.js 18+
- **语言**: TypeScript
- **协议**: Model Context Protocol (MCP)
- **HTTP客户端**: Axios
- **构建工具**: TypeScript Compiler

## 📡 MCP 工具列表

### 📚 笔记本操作 (Notebook)
- `list_notebooks` - 列出所有笔记本
- `open_notebook` - 打开笔记本
- `close_notebook` - 关闭笔记本
- `rename_notebook` - 重命名笔记本
- `remove_notebook` - 删除笔记本

### 📄 文档操作 (Document)
- `create_document` - 创建新文档
- `get_document` - 获取文档内容
- `update_document` - 更新文档
- `delete_document` - 删除文档
- `list_documents` - 列出文档
- `batch_read_all` - 批量读取所有文档

### 🧱 块操作 (Block)
- `create_block` - 创建块
- `get_block` - 获取块
- `update_block` - 更新块
- `delete_block` - 删除块
- `prepend_block` - 在块前插入
- `append_block` - 在块后追加
- `fold_block` - 折叠块
- `unfold_block` - 展开块
- `transfer_block_ref` - 转移块引用
- `set_block_attrs` - 设置块属性
- `get_block_attrs` - 获取块属性
- `batch_create_blocks` - 批量创建块
- `batch_update_blocks` - 批量更新块
- `batch_delete_blocks` - 批量删除块

### 🔍 搜索操作 (Search)
- `simple_search` - 简单搜索
- `recursive_search` - 递归搜索
- `search_in_document` - 在文档中搜索

### 🎨 模板操作 (Template)
- `render_template` - 渲染模板
- `render_sprig_template` - 渲染Sprig模板

### 📤 导出操作 (Export)
- `export_markdown` - 导出为Markdown
- `export_file` - 导出为指定格式
- `export_expand` - 导出为树状结构

### 🖼️ 资源操作 (Assets)
- `upload_asset` - 上传资源文件
- `list_assets` - 列出资源文件
- `rename_asset` - 重命名资源文件
- `ocr_asset` - OCR识别图片

### 💾 SQL查询 (SQL)
- `query_sql` - 执行SQL查询

### 📁 文件操作 (File)
- `read_file` - 读取文件
- `write_file` - 写入文件
- `delete_file` - 删除文件
- `list_files` - 列出文件

### ⏰ 系统操作 (System)
- `get_current_time` - 获取当前真实时间

## 📖 使用示例

### 创建文档
```typescript
// 创建新文档
await toolRegistry.execute('create_document', {
  notebook: 'notebook-id',
  path: '/path/to/document',
  title: '文档标题',
  content: '文档内容'
});
```

### 搜索内容
```typescript
// 递归搜索
await toolRegistry.execute('recursive_search', {
  query: '关键词',
  notebook: 'notebook-id',
  maxDepth: 5
});
```

### 批量操作
```typescript
// 批量创建块
await toolRegistry.execute('batch_create_blocks', {
  requests: [
    { content: '第一个块' },
    { content: '第二个块' }
  ]
});
```

### 获取时间
```typescript
// 获取当前时间
await toolRegistry.execute('get_current_time', {
  format: 'iso',
  timezone: 'Asia/Shanghai'
});
```

### 导出文档
```typescript
// 导出为Markdown
await toolRegistry.execute('export_markdown', {
  id: 'document-id'
});
```

## 🔧 开发

### 构建项目
```bash
npm run build
```

### 运行测试
```bash
npm test
```

### 代码检查
```bash
npm run lint
```

### 类型检查
```bash
npm run typecheck
```

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出改进建议！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

感谢思源笔记团队提供优秀的笔记软件和 API 支持。

## 📮 联系方式

- 问题反馈: [GitHub Issues](https://github.com/your-username/siyuan-mcp-server/issues)
- 功能建议: [GitHub Discussions](https://github.com/your-username/siyuan-mcp-server/discussions)
# SiYuan MCP Server

一个为思源笔记（SiYuan）设计的 Model Context Protocol (MCP) 服务器，提供 AI 集成和智能知识管理功能。

## 🌟 核心特性

### 📝 笔记管理
- **全文搜索**: 支持关键词搜索和高级查询语法
- **块操作**: 创建、读取、更新和删除笔记块
- **文档管理**: 完整的文档生命周期管理
- **笔记本操作**: 笔记本的创建、列表和管理

### 🏷️ 标签系统
- **智能标签**: 自动标签提取和管理
- **标签搜索**: 基于标签的内容发现
- **标签统计**: 使用频率和趋势分析

### 🔍 高级搜索
- **递归搜索**: 深度内容挖掘
- **批量操作**: 高效的批量数据处理
- **引用分析**: 内容关联和引用追踪
- **资源发现**: 自动发现相关资源和内容

### 🚀 性能优化
- **Token 优化**: 智能内容压缩和优化
- **缓存机制**: 多层缓存提升响应速度
- **批量处理**: 高效的批量数据操作
- **性能监控**: 实时性能指标和优化建议

### 🤖 AI 集成
- **智能助手**: AI 驱动的内容分析和建议
- **上下文管理**: 智能上下文存储和检索
- **提示模板**: 预定义的 AI 交互模板


## 🚀 快速开始

### 1. 安装思源笔记
1. 下载安装包：[https://github.com/siyuan-note/siyuan/releases](https://github.com/siyuan-note/siyuan/releases)
2. 启动思源笔记

### 2. 配置思源笔记
1. 启动思源笔记
2. 设置 → 关于 → API token
3. 复制API Token至SIYUAN_API_TOKEN

### MCP配置
```json
{
  "mcpServers": {
    "siyuan": {
      "command": "npx",
      "args": ["mcp-server-siyuan"],
      "env": {
        "SIYUAN_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

## 🛠️ 技术栈

- **运行时**: Node.js 18+
- **语言**: TypeScript
- **协议**: Model Context Protocol (MCP)
- **日志**: Pino 高性能日志库
- **HTTP客户端**: Axios
- **测试框架**: Jest
- **构建工具**: TypeScript Compiler

## 📡 MCP 工具

### 系统工具
- `system.health` - 系统健康检查
- `system.discover-ports` - 端口自动发现

### 笔记操作
- `notes.search` - 笔记搜索
- `blocks.get` - 获取块内容
- `blocks.create` - 创建新块
- `blocks.update` - 更新块内容
- `blocks.delete` - 删除块

### 文档管理
- `documents.list` - 列出文档
- `documents.create` - 创建文档
- `documents.get` - 获取文档内容
- `documents.update` - 更新文档

### 标签系统
- `tags.get_all` - 获取所有标签
- `tags.search` - 搜索标签
- `tags.manage` - 标签管理

### 高级功能
- `search.advanced` - 高级搜索
- `search.recursive` - 递归搜索
- `batch.operations` - 批量操作
- `references.analyze` - 引用分析

## 🎯 使用场景

### 知识管理
- 构建个人知识图谱
- 智能内容组织和分类
- 自动化笔记整理

### AI 辅助写作
- 智能内容建议
- 自动摘要生成
- 相关内容推荐

### 数据分析
- 笔记使用统计
- 内容关联分析
- 知识结构可视化

### 自动化工作流
- 批量内容处理
- 自动标签分类
- 定期内容整理

## 📊 性能特性

- **高并发**: 支持多客户端同时访问
- **低延迟**: 多层缓存机制
- **内存优化**: 智能内存管理
- **Token 效率**: 内容压缩和优化
- **错误恢复**: 自动重试和降级机制

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出改进建议。

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

感谢思源笔记团队提供优秀的笔记软件和 API 支持。
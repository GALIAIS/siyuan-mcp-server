/**
 * 终端编码处理工具
 * 解决Windows终端中文乱码问题
 */

/**
 * 设置Node.js进程的编码
 */
function setupEncoding(): void {
  // 设置标准输出编码为UTF-8
  if (process.stdout.setEncoding) {
    process.stdout.setEncoding('utf8');
  }
  
  // 设置标准错误输出编码为UTF-8
  if (process.stderr.setEncoding) {
    process.stderr.setEncoding('utf8');
  }
  
  // 设置环境变量
  process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || '--max-old-space-size=4096';
  
  // Windows特定设置
  if (process.platform === 'win32') {
    // 尝试设置控制台代码页
    try {
      const { execSync } = require('child_process');
      execSync('chcp 65001', { stdio: 'ignore' });
    } catch (error) {
      // 忽略错误，继续执行
    }
  }
}

/**
 * 安全的控制台输出，避免乱码
 */
function safeLog(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  try {
    // MCP协议要求：所有日志必须输出到stderr，不能污染stdout
    // 完全禁用日志输出 - 用户不需要任何日志
  } catch (error) {
    // 如果出现编码问题，使用ASCII安全输出
    const safeMessage = message.replace(/[^\x00-\x7F]/g, '?');
    // 完全禁用日志输出 - 用户不需要任何日志
  }
}

/**
 * 将中文消息转换为英文，避免乱码
 */
function toEnglishMessage(chineseMessage: string): string {
  const messageMap: Record<string, string> = {
    '正在扫描端口': 'Scanning port',
    '端口扫描完成': 'Port scan completed',
    '发现思源笔记实例': 'Found SiYuan instance',
    '连接成功': 'Connection successful',
    '连接失败': 'Connection failed',
    '开始端口发现': 'Starting port discovery',
    '端口发现完成': 'Port discovery completed',
    '未找到可用端口': 'No available port found',
    '服务器启动': 'Server started',
    '服务器停止': 'Server stopped',
    '初始化完成': 'Initialization completed',
    '配置加载': 'Configuration loaded',
    '错误': 'Error',
    '警告': 'Warning',
    '信息': 'Info'
  };
  
  return messageMap[chineseMessage] || chineseMessage;
}

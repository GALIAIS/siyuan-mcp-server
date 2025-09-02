import logger from '../logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export interface SiyuanPortInfo {
  port: number;
  baseURL: string;
  isFixed: boolean;
  version?: string;
}

/**
 * 思源笔记端口发现工具
 */
export class SiyuanPortDiscovery {
  private token: string;
  
  constructor(token: string) {
    this.token = token;
  }

  /**
   * 通过读取思源笔记的port.json文件获取端口信息
   */
  private async readPortFromConfigFile(): Promise<number | null> {
    try {
      logger.info('尝试从port.json文件读取端口信息...');
      
      // 构建port.json文件路径
      const homeDir = os.homedir();
      const portJsonPath = path.join(homeDir, '.config', 'siyuan', 'port.json');
      
      // 检查文件是否存在
      if (!fs.existsSync(portJsonPath)) {
        logger.info('port.json文件不存在');
        return null;
      }
      
      // 读取文件内容
      const fileContent = fs.readFileSync(portJsonPath, 'utf8');
      const portData = JSON.parse(fileContent);
      
      // 获取所有端口
      const ports = Object.values(portData) as string[];
      
      if (ports.length === 0) {
        logger.info('port.json文件中没有端口信息');
        return null;
      }
      
      // 验证每个端口
      for (const portStr of ports) {
        const port = parseInt(portStr);
        if (isNaN(port)) continue;
        
        logger.info(`验证port.json中的端口: ${port}`);
        
        if (await this.isValidSiyuanPort(port)) {
          logger.info(`port.json中的端口 ${port} 验证成功`);
          return port;
        }
      }
      
      logger.info('port.json中的端口都无法连接');
      return null;
    } catch (error) {
      logger.warn('读取port.json文件失败:', error);
      return null;
    }
  }

  /**
   * 通过SiYuan-Kernel.exe进程查找思源笔记占用的端口
   */
  private async findSiyuanProcessPort(): Promise<number | null> {
    try {
      logger.info('通过SiYuan-Kernel.exe进程查找端口...');
      
      // Windows系统命令
      if (process.platform === 'win32') {
        // 获取SiYuan-Kernel.exe进程PID列表
        const { stdout: processOutput } = await execAsync('tasklist /FI "IMAGENAME eq SiYuan-Kernel.exe" /FO CSV');
        const kernelPids = new Set();
        
        if (processOutput.includes('SiYuan-Kernel.exe')) {
          const lines = processOutput.split('\n');
          const kernelLines = lines.filter(line => line.includes('SiYuan-Kernel.exe'));
          
          for (const line of kernelLines) {
            const csvMatch = line.match(/"([^"]+)","(\d+)","([^"]+)","(\d+)","([^"]+)"/);
            if (csvMatch) {
              kernelPids.add(csvMatch[2]);
            }
          }
        }
        
        if (kernelPids.size === 0) {
          logger.info('未找到SiYuan-Kernel.exe进程');
          return null;
        }
        
        logger.info(`找到SiYuan-Kernel.exe进程PIDs: ${Array.from(kernelPids).join(', ')}`);
        
        // 获取所有监听端口
        const { stdout: netstatOutput } = await execAsync('netstat -ano | findstr LISTENING');
        const netstatLines = netstatOutput.split('\n');
        
        // 查找内核进程监听的端口
        for (const line of netstatLines) {
          if (line.includes('LISTENING')) {
            const match = line.match(/TCP\s+127\.0\.0\.1:(\d+)\s+.*LISTENING\s+(\d+)/);
            if (match) {
              const port = parseInt(match[1]);
              const pid = match[2];
              
              // 检查是否是SiYuan-Kernel.exe进程的PID
              if (kernelPids.has(pid)) {
                logger.info(`发现SiYuan-Kernel.exe进程 PID ${pid} 监听端口: ${port}`);
                
                // 验证端口是否真的是思源API
                if (await this.isValidSiyuanPort(port)) {
                  logger.info(`验证成功，端口 ${port} 是思源API`);
                  return port;
                }
              }
            }
          }
        }
        
        logger.info('SiYuan-Kernel.exe进程未监听任何有效的思源API端口');
        return null;
      } else {
        // Linux/macOS系统命令
        try {
          // 查找SiYuan-Kernel进程
          const { stdout: processOutput } = await execAsync('ps aux | grep -i siyuan-kernel | grep -v grep');
          
          if (!processOutput.trim()) {
            logger.info('未找到SiYuan-Kernel进程');
            return null;
          }
          
          // 获取进程PID
          const lines = processOutput.split('\n').filter(line => line.trim());
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 2) {
              const pid = parts[1];
              logger.info(`找到SiYuan-Kernel进程 PID: ${pid}`);
              
              try {
                // 查找该进程占用的端口
                const { stdout: lsofOutput } = await execAsync(`lsof -Pan -p ${pid} -i`);
                
                // 解析端口信息
                const portMatches = lsofOutput.match(/:(\d+)\s+\(LISTEN\)/g);
                if (portMatches) {
                  for (const match of portMatches) {
                    const portMatch = match.match(/:(\d+)/);
                    if (portMatch) {
                      const port = parseInt(portMatch[1]);
                      if (port >= 3000 && port <= 65535) {
                        logger.info(`发现SiYuan-Kernel进程监听端口: ${port}`);
                        
                        // 验证端口是否真的是思源API
                        if (await this.isValidSiyuanPort(port)) {
                          return port;
                        }
                      }
                    }
                  }
                }
              } catch (lsofError) {
                logger.warn(`查找PID ${pid} 的端口时出错:`, lsofError);
                continue;
              }
            }
          }
        } catch (error) {
          logger.warn('查找SiYuan-Kernel进程时出错:', error);
        }
      }
      
      logger.info('未能通过SiYuan-Kernel进程查找到思源端口');
      return null;
    } catch (error) {
      logger.warn('查找SiYuan-Kernel进程端口时出错:', error);
      return null;
    }
  }

  /**
   * 验证端口是否是有效的思源API端口
   */
  private async isValidSiyuanPort(port: number): Promise<boolean> {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/system/version`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(3000)
      });
      
      if (response.ok) {
        const data = await response.json();
        return data && typeof data === 'object' && data.code === 0;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }



  /**
   * 测试指定端口是否为思源笔记服务
   */
  private async testPort(port: number, isFixed: boolean, timeout = 5000): Promise<SiyuanPortInfo | null> {
    const baseURL = `http://127.0.0.1:${port}/`;
    
    try {
      // 创建超时控制器
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // 1. 测试基本连接
      const response = await fetch(baseURL, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'SiyuanMCP/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        return null;
      }

      // 2. 测试API端点
      const apiController = new AbortController();
      const apiTimeoutId = setTimeout(() => apiController.abort(), timeout);
      
      const apiResponse = await fetch(`${baseURL}/api/system/version`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${this.token}`,
          'User-Agent': 'SiyuanMCP/1.0'
        },
        body: JSON.stringify({}),
        signal: apiController.signal
      });

      clearTimeout(apiTimeoutId);

      if (apiResponse.ok) {
        const result = await apiResponse.json();
        
        // 验证是否为思源笔记API响应
        if (result && typeof result === 'object') {
          return {
            port,
            baseURL,
            isFixed,
            version: typeof result.data === 'string' ? result.data : (result.data?.version || result.data?.ver || result.data?.kernelVersion || 'detected')
          };
        }
      }

      return null;
    } catch (error) {
      // 忽略连接错误，这是正常的
      return null;
    }
  }



  /**
   * 自动发现并返回最佳端口配置
   */
  async autoDiscover(): Promise<{ baseURL: string; port: number; version?: string } | null> {
    logger.info('开始自动发现思源笔记端口...');
    
    try {
      // 1. 首先尝试从port.json文件读取端口（最直接的方法）
      const portFromFile = await this.readPortFromConfigFile();
      if (portFromFile) {
        logger.info(`从port.json文件发现思源端口: ${portFromFile}`);
        
        // 获取详细的端口信息包括版本
        const detailedInfo = await this.testPort(portFromFile, false);
        if (detailedInfo) {
          return {
            baseURL: detailedInfo.baseURL,
            port: detailedInfo.port,
            version: detailedInfo.version
          };
        }
        
        return {
          baseURL: `http://127.0.0.1:${portFromFile}/`,
          port: portFromFile,
          version: 'detected'
        };
      }
    } catch (error) {
      logger.warn('从port.json文件读取端口失败:', error);
    }
    
    try {
      // 2. 如果port.json方法失败，尝试通过SiYuan-Kernel.exe进程查找端口
      const siyuanPort = await this.findSiyuanProcessPort();
      if (siyuanPort) {
        logger.info(`通过SiYuan-Kernel.exe发现思源端口: ${siyuanPort}`);
        
        return {
          baseURL: `http://127.0.0.1:${siyuanPort}/`,
          port: siyuanPort,
          version: 'unknown'
        };
      }
    } catch (error) {
      logger.warn('通过SiYuan-Kernel.exe查找端口失败:', error);
    }
    
    // 如果所有方法都失败，返回null
    logger.warn('未发现任何可用的思源笔记端口');
    return null;
  }
}

/**
 * 创建端口发现器
 */
export function createPortDiscovery(token: string): SiyuanPortDiscovery {
  return new SiyuanPortDiscovery(token);
}
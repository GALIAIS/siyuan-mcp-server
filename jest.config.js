/**
 * Jest 测试配置
 * 用于 TypeScript 项目的测试环境配置
 */

module.exports = {
  // 测试环境
  testEnvironment: 'node',
  
  // 文件扩展名
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // 转换配置
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  
  // 测试文件匹配模式
  testMatch: [
    '**/__tests__/**/*.(ts|js)',
    '**/*.(test|spec).(ts|js)',
  ],
  
  // 忽略的文件和目录
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],
  
  // 覆盖率配置
  collectCoverageFrom: [
    'src/**/*.(ts|js)',
    '!src/**/*.d.ts',
    '!src/__tests__/**/*',
  ],
  
  // 覆盖率报告格式
  coverageReporters: ['text', 'lcov', 'html'],
  
  // 覆盖率输出目录
  coverageDirectory: 'coverage',
  
  // 模块路径映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  
  // 设置文件
  setupFilesAfterEnv: [],
  
  // 超时设置
  testTimeout: 10000,
  
  // 详细输出
  verbose: true,
  
  // TypeScript 配置
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
};
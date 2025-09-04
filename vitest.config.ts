import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      all: true,
      src: ['src/tools']
    }
  }
});
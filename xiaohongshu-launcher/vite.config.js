import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import electron from 'vite-plugin-electron';
import path from 'path';

export default defineConfig({
  plugins: [
    vue(),
    electron([
      {
        // 主进程入口
        entry: path.join(__dirname, 'src/main/index.js'),
        vite: {
          build: {
            outDir: path.join(__dirname, 'dist-electron/main'),
            rollupOptions: {
              external: ['electron', 'electron-updater']
            }
          }
        }
      },
      {
        // 预加载脚本入口
        entry: path.join(__dirname, 'src/preload/index.js'),
        onstart(args) {
          // 通知渲染进程重新加载
          args.reload();
        },
        vite: {
          build: {
            outDir: path.join(__dirname, 'dist-electron/preload'),
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      }
    ])
  ],
  // 渲染进程配置
  root: path.join(__dirname, 'src/renderer'),
  build: {
    outDir: path.join(__dirname, 'dist-electron/renderer'),
    emptyOutDir: true
  },
  server: {
    port: 5173
  }
});

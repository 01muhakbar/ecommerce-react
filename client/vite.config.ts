import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const logToTerminal = () => ({
  name: 'log-to-terminal',
  configureServer(server) {
    server.ws.on('my:log', (data, client) => {
      // data is { message: string }
      console.log(data.message);
    });
  },
  transformIndexHtml(html) {
    return [{
      tag: 'script',
      attrs: { type: 'module' },
      children: `
        if (import.meta.hot) {
          const originalError = console.error;
          console.error = (...args) => {
            originalError(...args);
            import.meta.hot.send('my:log', { message: '[CLIENT-ERROR] ' + args.join(' ') });
          };
          const originalLog = console.log;
          console.log = (...args) => {
            originalLog(...args);
            import.meta.hot.send('my:log', { message: '[CLIENT-LOG] ' + args.join(' ') });
          };
          const originalWarn = console.warn;
          console.warn = (...args) => {
            originalWarn(...args);
            import.meta.hot.send('my:log', { message: '[CLIENT-WARN] ' + args.join(' ') });
          };
        }
      `
    }]
  }
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), logToTerminal()],
})

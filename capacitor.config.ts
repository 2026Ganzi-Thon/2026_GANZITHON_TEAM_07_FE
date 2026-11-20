import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.teslang.preview',
  appName: '테슬랑',
  webDir: 'dist',
  // Native plugin diagnostics must not print login bodies or Authorization headers.
  loggingBehavior: 'none',
  server: { androidScheme: 'https', cleartext: false },
  android: { allowMixedContent: false },
  plugins: {
    // Native requests reach the existing HTTPS /api proxy without changing backend CORS.
    // Local assets/preview requests remain inside the WebView.
    CapacitorHttp: { enabled: true },
  },
};

export default config;

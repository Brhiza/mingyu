import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cc.aov.mingyu',
  appName: '命语',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#fbf7fc',
    allowMixedContent: false,
  },
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.portal.trulink.app',
  appName: 'BiKu v1.0 Biz Intelligent Key Unit',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    cleartext: true
  }
};

export default config;
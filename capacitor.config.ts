import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ironwage.game',
  appName: 'IRONWAGE',
  webDir: 'dist',
  backgroundColor: '#000000',
  plugins: {
    // The game runs full screen with the system bars hidden (see MainActivity). Left to its defaults,
    // the framework's own system-bars plugin shows the bars again at load and pads the page by their
    // size while they are up, and a page that is a few pixels short of the screen is drawn at three
    // times instead of four.
    SystemBars: { hidden: true, insetsHandling: 'disable' },
  },
};

export default config;

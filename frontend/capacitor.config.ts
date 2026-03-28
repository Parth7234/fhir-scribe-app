import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.teameclipse.fhirscribe',
  appName: 'AI Ambient Scribe',
  webDir: 'dist',
  server: {
    // For production: the app will use the built web files bundled inside the APK.
    // For development with live reload, uncomment the line below and set your local IP:
    // url: 'http://192.168.x.x:5173',
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a0a1a',
      showSpinner: false,
    },
  },
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.teameclipse.fhirscribe',
  appName: 'AI Ambient Scribe',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Allow the WebView to communicate with Supabase and your backend
    allowNavigation: [
      'kjfsukbvgfrsysckdksd.supabase.co',
      '*.supabase.co',
      'fhir-scribe-app.onrender.com',
      '*.onrender.com',
      'localhost',
      '10.0.2.2',
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a0a1a',
      showSpinner: false,
    },
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static build only — the output in dist/ is what Firebase Hosting serves.
// There is no server runtime anywhere in this project, which is exactly what
// keeps it inside the free (Spark) plan with no billing account attached.
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'safari15',
    cssTarget: 'safari15',
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split the Firebase SDK out so the app shell paints fast over
        // school/home Wi-Fi on an iPad.
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        },
      },
    },
  },
});

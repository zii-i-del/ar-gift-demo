import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';

export default defineConfig({
  root:fileURLToPath(new URL('.',import.meta.url)),
  publicDir:fileURLToPath(new URL('../../public',import.meta.url)),
  plugins:[react()],
  server:{host:'127.0.0.1',port:3002,strictPort:true},
  build:{outDir:'../../visual-test-dist',emptyOutDir:true,copyPublicDir:false},
});

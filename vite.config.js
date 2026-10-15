import {defineConfig} from 'vite';

// Relative asset paths, so the build works under the GitHub Pages subpath
// (/3d-interactive-building-model/) as well as at a domain root.
export default defineConfig({
  base: './',
  // a dev server started with PORT set (e.g. by a preview tool) takes that port; otherwise 5173
  server: process.env.PORT ? {port: Number(process.env.PORT), strictPort: true} : {},
});

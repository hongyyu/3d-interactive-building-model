import {defineConfig} from 'vite';

// Relative asset paths, so the build works under the GitHub Pages subpath
// (/3d-interactive-building-model/) as well as at a domain root.
export default defineConfig({
  base: './',
  // a dev server started with PORT set (e.g. by a preview tool) takes that port; otherwise 5173
  server: process.env.PORT ? {port: Number(process.env.PORT), strictPort: true} : {},
  build: {
    rolldownOptions: {
      // the copyright notice heads the app's entry chunk; postBanner is added after minification, so it
      // survives. The lazy SheetJS chunk is third-party code and keeps only its own notice.
      output: {
        postBanner: chunk => chunk.isEntry
          ? '/*! Dado. Copyright (c) 2026 Hongyu Li and Zining Cheng. All rights reserved.\n' +
            ' * Third-party code bundled in this file keeps its own license. */'
          : '',
      },
    },
  },
});

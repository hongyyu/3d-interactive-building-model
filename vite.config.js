import {defineConfig} from 'vite';

// Relative asset paths, so the build works under the GitHub Pages subpath
// (/3d-interactive-building-model/) as well as at a domain root.
export default defineConfig({
  base: './',
});

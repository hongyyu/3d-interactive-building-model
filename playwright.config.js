import {defineConfig} from '@playwright/test';

// Visual regression test: builds the app, serves dist/ and replays a fixed scenario.
// Baselines are rendered with SwiftShader (software WebGL) at a fixed size so they are
// deterministic, but they are platform-specific (the *-darwin files come from macOS).
export default defineConfig({
  testDir: 'tests',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', {open: 'never'}]],
  expect: {
    // SwiftShader antialiasing leaves ±1 colour noise on a few edge pixels between frames.
    // threshold 0.01 absorbs that (up to ~±4 levels per channel); any larger change fails.
    toHaveScreenshot: {threshold: 0.01, maxDiffPixels: 0},
  },
  use: {
    baseURL: 'http://localhost:4174/',
    browserName: 'chromium',
    viewport: {width: 1440, height: 900},
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    launchOptions: {args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars']},
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4174 --strictPort',
    url: 'http://localhost:4174/',
    reuseExistingServer: false,
  },
});

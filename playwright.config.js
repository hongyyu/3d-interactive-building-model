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
    // SwiftShader antialiasing is not perfectly repeatable: edge pixels wobble by ±1 colour level,
    // and in roughly 1 run in 15 a single short edge shifts by ~10 levels (about 35 px).
    // threshold 0.01 absorbs the first and maxDiffPixels 100 the second; real changes differ
    // by hundreds to thousands of pixels (a 0.3 -> 0.25 edge-opacity change: 149 to 4724).
    toHaveScreenshot: {threshold: 0.01, maxDiffPixels: 100},
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

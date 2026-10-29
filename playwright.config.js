import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',fullyParallel:false,workers:1,timeout:40000,
  expect:{timeout:10000},reporter:[['list']],
  use:{baseURL:'http://localhost:4173',trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:{command:'node scripts/serve.mjs',url:'http://localhost:4173',reuseExistingServer:!process.env.CI},
  projects:[
    {name:'iPad-chromium',use:{...devices['iPad Pro 11 landscape'],browserName:'chromium',launchOptions:process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}}},
    {name:'iPad-webkit',use:{...devices['iPad Pro 11 landscape'],browserName:'webkit'}},
  ],
});

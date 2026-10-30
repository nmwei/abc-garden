import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',fullyParallel:false,workers:1,timeout:40000,
  expect:{timeout:10000},reporter:[['list']],
  use:{baseURL:'http://localhost:4173',trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:{command:'node scripts/serve.mjs',url:'http://localhost:4173',reuseExistingServer:!process.env.CI},
  projects:[
    {name:'iPad-chromium',use:{...devices['iPad Pro 11 landscape'],browserName:'chromium',launchOptions:process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}}},
    {name:'iPad-webkit',use:{...devices['iPad Pro 11 landscape'],browserName:'webkit',launchOptions:process.env.WEBKIT_PATH?{executablePath:process.env.WEBKIT_PATH}:{}}},
    {name:'phone-chromium',use:{...devices['iPhone 13'],browserName:'chromium',launchOptions:process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}}},
    {name:'phone-webkit',use:{...devices['iPhone 13'],browserName:'webkit',launchOptions:process.env.WEBKIT_PATH?{executablePath:process.env.WEBKIT_PATH}:{}}},
    {name:'desktop-chromium',use:{viewport:{width:1440,height:1000},browserName:'chromium',launchOptions:process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}}},
    {name:'desktop-webkit',use:{viewport:{width:1440,height:1000},browserName:'webkit',launchOptions:process.env.WEBKIT_PATH?{executablePath:process.env.WEBKIT_PATH}:{}}},
  ],
});

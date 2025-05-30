import { join } from 'path';

/** @type {import("puppeteer").Configuration} */
const config = {
  cacheDirectory: join(process.cwd(), '.cache', 'puppeteer'),
};

export default config;

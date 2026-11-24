import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://latimerhl.github.io',
  base: process.env.GITHUB_ACTIONS === 'true' ? '/ranching-handbook' : '/',
  trailingSlash: 'never',
  build: { format: 'file' },
});

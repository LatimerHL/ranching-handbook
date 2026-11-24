import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://latimerhl.github.io',
  // A branch preview is published under a deeper path of the same site, so the base has to be
  // overridable; the production deploy leaves SITE_BASE unset.
  base: process.env.SITE_BASE ?? (process.env.GITHUB_ACTIONS === 'true' ? '/ranching-handbook' : '/'),
  trailingSlash: 'never',
  build: { format: 'file' },
});

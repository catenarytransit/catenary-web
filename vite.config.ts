import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import { execSync } from 'child_process';

import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	plugins: [
		sveltekit(),
		tailwindcss(),
		VitePWA({
			// Do not immediately claim tabs running an older JS bundle. Doing so can
			// make lazy-loaded locale/feature chunks come from a different deployment.
			registerType: 'prompt',
			workbox: {
				cleanupOutdatedCaches: true,
				navigateFallback: null
			}
		})
	],
	server: {
		fs: {
			allow: ['../dist', 'static/']
		}
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	},
	define: {
		_COMMIT_ID: JSON.stringify(execSync('git rev-parse HEAD').toString().trim()),
		_COMMIT_DATE: JSON.stringify(
			new Date(parseInt(execSync('git log -1 --format=%at').toString().trim()) * 1000).toISOString()
		)
	},
	build: {
		sourcemap: true,
		minify: 'esbuild'
	},
	preview: {
		allowedHosts: ['maps.catenarymaps.org']
	}
});

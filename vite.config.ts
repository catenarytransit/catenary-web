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
			// This is the key setting
			registerType: 'autoUpdate',

			// These options are often implied by 'autoUpdate'
			// but are good to include explicitly.
			// This ensures the new service worker activates immediately.
			workbox: {
				skipWaiting: true,
				clientsClaim: true,
				navigateFallback: null
			}
		})
	],
	server: {
		fs: {
			allow: ['../dist']
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
		minify: false
	},
	preview: {
		allowedHosts: ['maps.catenarymaps.org']
	}
});

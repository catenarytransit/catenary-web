import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import { execSync } from 'child_process';

import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Replace the shell pipeline that used `date -ud` with this portable JS version.
// macOS `date` does not support `-u` or `-d` flags, so this ensures compatibility.
const buildTimestamp = (() => {
	try {
		const ts = execSync('git log -1 --format="%at"', { stdio: 'pipe' })
			.toString()
			.trim();
		if (ts && /^\d+$/.test(ts)) {
			return new Date(Number(ts) * 1000).toISOString();
		}
	} catch (e) {
		// git not available or not a repo — fall back to current time
	}
	return new Date().toISOString();
})();

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
				clientsClaim: true
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
		_COMMIT_DATE: JSON.stringify(buildTimestamp)
	},
	build: {
		sourcemap: true,
		minify: false
	},
	preview: {
		allowedHosts: ['maps.catenarymaps.org']
	}
});

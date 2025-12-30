import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import adapter from '@sveltejs/adapter-node';
//import adapter from 'svelte-adapter-deno';

import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { execSync } from 'child_process';

import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

//import adapter from '@sveltejs/adapter-node';

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

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	server: {
		fs: {
			allow: ['../dist']
		}
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	},
	build: {
		sourcemap: true,
		minify: false
	},
	define: {
		_COMMIT_ID: JSON.stringify(execSync('git rev-parse HEAD').toString().trim()),
		_COMMIT_DATE: JSON.stringify(buildTimestamp)
	},
	kit: {
		adapter: adapter()
	},
	preview: {
		allowedHosts: ['maps.catenarymaps.org']
	}
};

export default config;

import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import adapter from '@sveltejs/adapter-cloudflare';
//import adapter from '@sveltejs/adapter-node'

import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { execSync } from 'child_process';

import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: vitePreprocess(),
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
			execSync('git log -1 --format="%at" | xargs -I{} date -ud @{} \"+%Y-%m-%dT%H:%M:%SZ\"')
				.toString()
				.trim()
		)
	},
	kit: {
		// adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
		// If your environment is not supported or you settled on a specific environment, switch out the adapter.
		// See https://kit.svelte.dev/docs/adapters for more information about adapters.
		adapter: adapter(),
		alias: {
			'$components': 'src/components',
			'$root': 'src'
		}
    }
};

export default config;

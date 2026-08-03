import { get } from 'svelte/store';
import { locale } from 'svelte-i18n';
import { init_locales } from '$root/i18n';
import { init_stores } from '$components/init_stores';
import { refreshUIMaplibre } from '$components/transitionDarkAndLight';
import { StackInterface, OsmStationStack } from '$components/stackenum';
import {
	consentGiven,
	data_stack_store,
	show_my_location_store,
	show_zombie_buses_store,
	ui_theme_store
} from '$root/globalstores';
import { start_location_watch } from '$root/user_location_lib';
import { darkMode } from '$lib/shared/theme/theme';
import { initializeOverlayState } from './state/overlays';

let modulesInitialized = false;

export function initializeApplicationModules(): void {
	if (modulesInitialized) {
		return;
	}

	modulesInitialized = true;
	init_locales();
	init_stores();

	if (typeof window !== 'undefined') {
		applyDarkMode(
			resolveDarkMode(
				get(ui_theme_store),
				window.matchMedia('(prefers-color-scheme: dark)')
			)
		);
	}
}

function resolveDarkMode(theme: string, mediaQuery: MediaQueryList): boolean {
	if (theme === 'dark') {
		return true;
	}

	if (theme === 'light') {
		return false;
	}

	return mediaQuery.matches;
}

function applyDarkMode(enabled: boolean): void {
	darkMode.set(enabled);
	document.body.classList.toggle('dark', enabled);
}

function preloadFeatureScreens(): void {
	void Promise.all([
		import('$components/MapSelectionScreen.svelte'),
		import('$components/LayerSettingsBox.svelte'),
		import('$components/RouteHeading.svelte'),
		import('$components/StopScreen.svelte')
	]).catch((error) => {
		console.warn('Unable to preload one or more feature screens.', error);
	});
}

function registerServiceWorker(): void {
	if (!('serviceWorker' in navigator)) {
		preloadFeatureScreens();
		return;
	}

	void navigator.serviceWorker
		.register('/sw.js', { scope: '/' })
		.then(() => {
			preloadFeatureScreens();
			console.log('Service worker registration succeeded.');
		})
		.catch((error) => {
			preloadFeatureScreens();
			console.error('Service worker registration failed.', error);
		});
}

function initializeUrlState(searchParams: URLSearchParams): void {
	const osmStationId = searchParams.get('osmstation');
	if (!osmStationId) {
		return;
	}

	data_stack_store.update((stack) => {
		if (
			stack.some(
				(entry) => entry.data instanceof OsmStationStack && entry.data.osm_id === osmStationId
			)
		) {
			return stack;
		}

		return [...stack, new StackInterface(new OsmStationStack(osmStationId, null, null))];
	});
}

function initializeGoogleAnalytics(): void {
	window.dataLayer ??= [];
	const gtag =
		window.gtag ??
		((...args: unknown[]) => {
			window.dataLayer.push(args);
		});
	window.gtag = gtag;
	gtag('js', new Date());
	gtag('consent', 'default', { analytics_storage: 'denied' });
}

export function startBrowserRuntime(): () => void {
	const cleanups: Array<() => void> = [];
	const searchParams = new URLSearchParams(window.location.search);
	const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');

	initializeGoogleAnalytics();
	initializeOverlayState(searchParams, navigator.userAgent);
	initializeUrlState(searchParams);
	registerServiceWorker();

	if (localStorage.getItem('show-my-location') === 'false') {
		show_my_location_store.set(false);
	}

	if (localStorage.getItem('showzombiebuses') === 'true') {
		show_zombie_buses_store.set(true);
	}

	const storedLocale = localStorage.getItem('language');
	if (storedLocale) {
		locale.set(storedLocale);
	}

	cleanups.push(
		locale.subscribe((value) => {
			if (value) {
				localStorage.setItem('language', value);
			}
		})
	);

	const updateTheme = (theme = get(ui_theme_store), refreshMap = true) => {
		applyDarkMode(resolveDarkMode(theme, colorScheme));
		if (refreshMap) {
			refreshUIMaplibre();
		}
	};

	let hasAppliedInitialTheme = false;
	cleanups.push(
		ui_theme_store.subscribe((theme) => {
			updateTheme(theme, hasAppliedInitialTheme);
			hasAppliedInitialTheme = true;
		})
	);

	const handleColorSchemeChange = () => {
		if (get(ui_theme_store) === 'system') {
			updateTheme('system');
		}
	};
	colorScheme.addEventListener('change', handleColorSchemeChange);
	cleanups.push(() => colorScheme.removeEventListener('change', handleColorSchemeChange));

	cleanups.push(
		consentGiven.subscribe((value) => {
			if (typeof window.gtag !== 'function') {
				return;
			}

			window.gtag('consent', 'update', {
				analytics_storage: value === true ? 'granted' : 'denied'
			});

			if (value === true) {
				window.gtag('config', 'G-QJRT4Q71T1');
			}
		})
	);

	const stopLocationWatch = start_location_watch();
	if (stopLocationWatch) {
		cleanups.push(stopLocationWatch);
	}

	return () => {
		for (const cleanup of cleanups.reverse()) {
			cleanup();
		}
	};
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writable } from 'svelte/store';
import { startBrowserRuntime } from './bootstrap';
import { start_location_watch } from '$root/user_location_lib';
import {
	dismissAppDownloadPopup,
	showAndroidDownloadPopup,
	showIosDownloadPopup
} from './state/overlays';

vi.mock('svelte-i18n', () => ({ locale: writable('en') }));
vi.mock('$root/i18n', () => ({ init_locales: vi.fn(), normalizeLocale: (s: string) => s }));
vi.mock('$components/init_stores', () => ({ init_stores: vi.fn() }));
vi.mock('$components/deeplinkreader', () => ({ deep_link_url_reader: vi.fn() }));
vi.mock('$components/transitionDarkAndLight', () => ({ refreshUIMaplibre: vi.fn() }));
vi.mock('$root/globalstores', () => ({
	consentGiven: writable(false),
	data_stack_store: writable([]),
	show_my_location_store: writable(true),
	show_zombie_buses_store: writable(false),
	ui_theme_store: writable('system')
}));
vi.mock('$root/user_location_lib', () => ({ start_location_watch: vi.fn() }));
vi.mock('$components/MapSelectionScreen.svelte', () => ({ default: {} }));
vi.mock('$components/LayerSettingsBox.svelte', () => ({ default: {} }));
vi.mock('$components/RouteHeading.svelte', () => ({ default: {} }));
vi.mock('$components/StopScreen.svelte', () => ({ default: {} }));

let cleanup: (() => void) | undefined;
const stopWatch = vi.fn();

beforeEach(() => {
	const storage = new Map<string, string>();
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => storage.set(key, value),
		removeItem: (key: string) => storage.delete(key)
	});
	vi.stubGlobal('window', {
		location: { search: '' },
		matchMedia: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
	});
	vi.stubGlobal('document', { body: { classList: { toggle: vi.fn() } } });
	vi.mocked(start_location_watch).mockReturnValue(stopWatch);
});

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});

describe('location startup after download prompts', () => {
	it.each([
		['android', 'Mozilla/5.0 (Linux; Android 14) Chrome/123', 1],
		['ios', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)', 1],
		['ios', 'Mozilla/5.0 (iPad; CPU OS 18_0)', 5],
		['ios', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 5]
	] as const)(
		'defers location on %s until Keep using web (%s)',
		(platform, userAgent, maxTouchPoints) => {
			vi.stubGlobal('navigator', { userAgent, maxTouchPoints });
			cleanup = startBrowserRuntime();
			expect(start_location_watch).not.toHaveBeenCalled();

			dismissAppDownloadPopup(platform);
			expect(start_location_watch).toHaveBeenCalledOnce();
			dismissAppDownloadPopup(platform);
			expect(start_location_watch).toHaveBeenCalledOnce();
			cleanup();
			cleanup = undefined;
			expect(stopWatch).toHaveBeenCalledOnce();
		}
	);

	it.each(['android', 'ios'] as const)(
		'does not request location when opening the %s store',
		(platform) => {
			vi.stubGlobal('navigator', { userAgent: platform === 'android' ? 'Android' : 'iPhone' });
			cleanup = startBrowserRuntime();
			(platform === 'android' ? showAndroidDownloadPopup : showIosDownloadPopup).set(false);
			expect(start_location_watch).not.toHaveBeenCalled();
		}
	);

	it.each([
		['Android', 'androidPopupDismissedUntil'],
		['iPhone', 'iosPopupDismissedUntil']
	])('starts immediately for %s with an active dismissal', (userAgent, key) => {
		vi.stubGlobal('navigator', { userAgent });
		localStorage.setItem(key, String(Date.now() + 60_000));
		cleanup = startBrowserRuntime();
		expect(start_location_watch).toHaveBeenCalledOnce();
	});

	it('starts immediately on desktop', () => {
		vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh)', maxTouchPoints: 0 });
		cleanup = startBrowserRuntime();
		expect(start_location_watch).toHaveBeenCalledOnce();
	});

	it('unsubscribes before a deferred startup can occur after teardown', () => {
		vi.stubGlobal('navigator', { userAgent: 'Android' });
		cleanup = startBrowserRuntime();
		cleanup();
		cleanup = undefined;
		dismissAppDownloadPopup('android');
		expect(start_location_watch).not.toHaveBeenCalled();
	});
});

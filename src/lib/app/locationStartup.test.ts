import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import {
	initializeOverlayState,
	dismissAndroidDownloadPopup,
	dismissIosDownloadPopup,
	showAndroidDownloadPopup,
	showIosDownloadPopup
} from './state/overlays';
import { startLocationAfterDownloadPrompt } from './locationStartup';

const android = 'Mozilla/5.0 (Linux; Android 15)';
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)';
const desktop = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

describe('location startup after the download prompt', () => {
	let cleanup: (() => void) | undefined;

	beforeEach(() => {
		const storage = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => storage.set(key, value),
			removeItem: (key: string) => storage.delete(key)
		});
		showAndroidDownloadPopup.set(false);
		showIosDownloadPopup.set(false);
	});

	afterEach(() => {
		cleanup?.();
		cleanup = undefined;
		vi.unstubAllGlobals();
	});

	it.each([
		['Android', android, 0, showAndroidDownloadPopup, dismissAndroidDownloadPopup],
		['iPhone', iphone, 0, showIosDownloadPopup, dismissIosDownloadPopup],
		[
			'iPad desktop user agent',
			'Mozilla/5.0 (Macintosh; Intel Mac OS X)',
			5,
			showIosDownloadPopup,
			dismissIosDownloadPopup
		]
	] as const)('waits for %s users to choose the web', (_name, ua, touches, popup, dismiss) => {
		initializeOverlayState(new URLSearchParams(), ua, touches);
		const stop = vi.fn();
		const start = vi.fn(() => stop);
		cleanup = startLocationAfterDownloadPrompt(start);

		expect(get(popup)).toBe(true);
		expect(start).not.toHaveBeenCalled();
		dismiss();
		expect(start).toHaveBeenCalledOnce();
		popup.set(false);
		expect(start).toHaveBeenCalledOnce();
		cleanup();
		cleanup = undefined;
		expect(stop).toHaveBeenCalledOnce();
	});

	it.each([desktop, 'Mozilla/5.0 (Macintosh; Intel Mac OS X)'])(
		'starts immediately on desktop: %s',
		(ua) => {
			initializeOverlayState(new URLSearchParams(), ua, 0);
			const start = vi.fn();
			cleanup = startLocationAfterDownloadPrompt(start);
			expect(get(showAndroidDownloadPopup)).toBe(false);
			expect(get(showIosDownloadPopup)).toBe(false);
			expect(start).toHaveBeenCalledOnce();
		}
	);

	it.each([
		[android, 'androidPopupDismissedUntil'],
		[iphone, 'iosPopupDismissedUntil']
	])('starts immediately with an active dismissal: %s', (ua, key) => {
		localStorage.setItem(key, String(Date.now() + 60000));
		initializeOverlayState(new URLSearchParams(), ua);
		const start = vi.fn();
		cleanup = startLocationAfterDownloadPrompt(start);
		expect(start).toHaveBeenCalledOnce();
	});

	it.each([
		[android, 'androidPopupDismissedUntil', showAndroidDownloadPopup],
		[iphone, 'iosPopupDismissedUntil', showIosDownloadPopup]
	] as const)('waits when a dismissal has expired: %s', (ua, key, popup) => {
		localStorage.setItem(key, String(Date.now() - 1000));
		initializeOverlayState(new URLSearchParams(), ua);
		const start = vi.fn();
		cleanup = startLocationAfterDownloadPrompt(start);
		expect(get(popup)).toBe(true);
		expect(start).not.toHaveBeenCalled();
	});

	it('starts after choosing the app and closing its prompt', () => {
		initializeOverlayState(new URLSearchParams(), android);
		const start = vi.fn();
		cleanup = startLocationAfterDownloadPrompt(start);
		showAndroidDownloadPopup.set(false);
		expect(start).toHaveBeenCalledOnce();
	});

	it('removes the pending subscription on unmount', () => {
		initializeOverlayState(new URLSearchParams(), iphone);
		const start = vi.fn();
		cleanup = startLocationAfterDownloadPrompt(start);
		cleanup();
		cleanup = undefined;
		dismissIosDownloadPopup();
		expect(start).not.toHaveBeenCalled();
	});
});

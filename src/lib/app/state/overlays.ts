import { writable } from 'svelte/store';
import { hasActiveExpiry, setExpiry } from '$lib/shared/browser/expiringStorage';

const ANDROID_DISMISSAL_KEY = 'androidPopupDismissedUntil';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const showAndroidDownloadPopup = writable(false);

function migrateLegacyAndroidDismissal(): boolean {
	const legacyDismissed =
		localStorage.getItem('androidPopupDismissed') === 'true' ||
		localStorage.getItem('androidPopupDismissed2') === 'true';

	if (!legacyDismissed) {
		return false;
	}

	setExpiry(ANDROID_DISMISSAL_KEY, ONE_DAY_MS);
	localStorage.removeItem('androidPopupDismissed');
	localStorage.removeItem('androidPopupDismissed2');
	return true;
}

export function initializeOverlayState(searchParams: URLSearchParams, userAgent: string): void {
	const androidPreview = searchParams.has('androidpopup');
	const isAndroid = /android/i.test(userAgent);
	const androidDismissed = hasActiveExpiry(ANDROID_DISMISSAL_KEY) || migrateLegacyAndroidDismissal();

	showAndroidDownloadPopup.set(androidPreview || (isAndroid && !androidDismissed));
}

import { writable } from 'svelte/store';
import { hasActiveExpiry, setExpiry } from '$lib/shared/browser/expiringStorage';

const ANDROID_DISMISSAL_KEY = 'androidPopupDismissedUntil';
const IOS_DISMISSAL_KEY = 'iosPopupDismissedUntil';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const showAndroidDownloadPopup = writable(false);
export const showIosDownloadPopup = writable(false);

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

export function initializeOverlayState(
	searchParams: URLSearchParams,
	userAgent: string,
	maxTouchPoints = 0
): void {
	const androidPreview = searchParams.has('androidpopup');
	const isIos =
		/iPad|iPhone|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
	showIosDownloadPopup.set(isIos && !hasActiveExpiry(IOS_DISMISSAL_KEY));

	const isAndroid = /android/i.test(userAgent);
	const androidDismissed =
		hasActiveExpiry(ANDROID_DISMISSAL_KEY) || migrateLegacyAndroidDismissal();

	showAndroidDownloadPopup.set(androidPreview || (isAndroid && !androidDismissed));
}

export function dismissAndroidDownloadPopup(): void {
	setExpiry(ANDROID_DISMISSAL_KEY, ONE_WEEK_MS);
	localStorage.removeItem('androidPopupDismissed');
	localStorage.removeItem('androidPopupDismissed2');
	showAndroidDownloadPopup.set(false);
}

export function dismissIosDownloadPopup(): void {
	setExpiry(IOS_DISMISSAL_KEY, ONE_WEEK_MS);
	showIosDownloadPopup.set(false);
}

import { get, writable } from 'svelte/store';
import { hasActiveExpiry, setExpiry } from '$lib/shared/browser/expiringStorage';

const ANDROID_DISMISSAL_KEY = 'androidPopupDismissedUntil';
const IOS_DISMISSAL_KEY = 'iosPopupDismissedUntil';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DONATION_DISMISSAL_KEY = 'serverDonationPopupDismissedUntil';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const showAndroidDownloadPopup = writable(false);
export const showIosDownloadPopup = writable(false);
// Remain blocked until startup has checked both mobile download prompts.
export const canStartLocationWatch = writable(false);
export const showDonationPopup = writable(false);

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
	const donationPreview =
		searchParams.get('donation_preview') === 'true' ||
		searchParams.get('ios_donation_preview') === 'true';

	showDonationPopup.set(donationPreview || !hasActiveExpiry(DONATION_DISMISSAL_KEY));

	const androidPreview = searchParams.has('androidpopup');
	const isAndroid = /android/i.test(userAgent);
	const androidDismissed =
		hasActiveExpiry(ANDROID_DISMISSAL_KEY) || migrateLegacyAndroidDismissal();

	const showAndroid = androidPreview || (isAndroid && !androidDismissed);
	const isIos =
		/iPad|iPhone|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
	const showIos = isIos && !hasActiveExpiry(IOS_DISMISSAL_KEY);

	showAndroidDownloadPopup.set(showAndroid);
	showIosDownloadPopup.set(showIos);
	canStartLocationWatch.set(!showAndroid && !showIos);
}

export function dismissDonationPopup(): void {
	if (!get(showDonationPopup)) {
		return;
	}

	showDonationPopup.set(false);
	setExpiry(DONATION_DISMISSAL_KEY, ONE_DAY_MS);
}

export function dismissAppDownloadPopup(platform: 'android' | 'ios'): void {
	const popup = platform === 'android' ? showAndroidDownloadPopup : showIosDownloadPopup;
	const key = platform === 'android' ? ANDROID_DISMISSAL_KEY : IOS_DISMISSAL_KEY;
	setExpiry(key, ONE_WEEK_MS);
	popup.set(false);
	canStartLocationWatch.set(!get(showAndroidDownloadPopup) && !get(showIosDownloadPopup));
}

import { get, writable } from 'svelte/store';
import { hasActiveExpiry, setExpiry } from '$lib/shared/browser/expiringStorage';

const ANDROID_DISMISSAL_KEY = 'androidPopupDismissedUntil';
const DONATION_DISMISSAL_KEY = 'serverDonationPopupDismissedUntil';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const showAndroidDownloadPopup = writable(false);
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

export function initializeOverlayState(searchParams: URLSearchParams, userAgent: string): void {
	const donationPreview =
		searchParams.get('donation_preview') === 'true' ||
		searchParams.get('ios_donation_preview') === 'true';

	showDonationPopup.set(donationPreview || !hasActiveExpiry(DONATION_DISMISSAL_KEY));

	const androidPreview = searchParams.has('androidpopup');
	const isAndroid = /android/i.test(userAgent);
	const androidDismissed = hasActiveExpiry(ANDROID_DISMISSAL_KEY) || migrateLegacyAndroidDismissal();

	showAndroidDownloadPopup.set(androidPreview || (isAndroid && !androidDismissed));
}

export function dismissDonationPopup(): void {
	if (!get(showDonationPopup)) {
		return;
	}

	showDonationPopup.set(false);
	setExpiry(DONATION_DISMISSAL_KEY, ONE_DAY_MS);
}

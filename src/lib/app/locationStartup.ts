import { derived } from 'svelte/store';
import { showAndroidDownloadPopup, showIosDownloadPopup } from './state/overlays';

// Overlay state must be initialized before subscribing: stores emit immediately.
export function startLocationAfterDownloadPrompt(
	startLocationWatch: () => (() => void) | undefined
): () => void {
	let started = false;
	let stopLocationWatch: (() => void) | undefined;
	const unsubscribe = derived(
		[showAndroidDownloadPopup, showIosDownloadPopup],
		([$android, $ios]) => $android || $ios
	).subscribe((showDownloadPopup) => {
		if (!showDownloadPopup && !started) {
			started = true;
			stopLocationWatch = startLocationWatch();
		}
	});

	return () => {
		unsubscribe();
		stopLocationWatch?.();
	};
}

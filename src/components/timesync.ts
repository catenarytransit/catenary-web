import { get } from 'svelte/store';
import { clock_skew_store } from '../globalstores';

export async function checkClockSkew() {
	try {
		const start = performance.now();
		const response = await fetch('https://maps.catenarymaps.org/cdn-cgi/trace');
		const text = await response.text();
		const end = performance.now();

		// Parse the "ts" line (e.g., ts=1713636136.123)
		const lines = text.split('\n');
		const serverTsLine = lines.find((l) => l.startsWith('ts='));
		if (!serverTsLine) return;
		const serverTimeInSeconds = parseFloat(serverTsLine.split('=')[1]);

		const serverTimeMs = serverTimeInSeconds * 1000;
		const localTimeMs = Date.now();

		// Calculate latency to refine the result (optional)
		const latency = (end - start) / 2;
		const adjustedServerTime = serverTimeMs + latency;

		const skew = localTimeMs - adjustedServerTime;
		clock_skew_store.set(skew);
		console.log(`Your clock is ${Math.abs(skew).toFixed(2)}ms ${skew > 0 ? 'ahead' : 'behind'}.`);
	} catch (error) {
		console.error('Failed to check clock skew:', error);
	}
}

const workerStartRealTime = Date.now();
const workerStartPerformanceTime = performance.now();

async function runCheck() {
	const serverTimeEndpoint = 'https://birch.catenarymaps.org/microtime';

	try {
		const clientStartPerf = performance.now();
		const response = await fetch(serverTimeEndpoint);
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		const data = await response.text();
		const clientEndPerf = performance.now();

		const serverTimeUs = parseInt(data, 10);
		if (isNaN(serverTimeUs)) {
			throw new Error('Invalid server time format');
		}
		const serverTime = serverTimeUs / 1000;

		const clientStart = workerStartRealTime + (clientStartPerf - workerStartPerformanceTime);
		const clientEnd = workerStartRealTime + (clientEndPerf - workerStartPerformanceTime);
		const roundTripTime = clientEndPerf - clientStartPerf;
		const offset = (clientEnd + clientStart) / 2 - serverTime;

		const syncThresholdMs = 1000;
		const isSynchronized = Math.abs(offset) <= syncThresholdMs;

		self.postMessage({
			success: true,
			result: {
				offset,
				isSynchronized,
				clientStart,
				clientEnd,
				serverTime,
				roundTripTime
			}
		});
	} catch (error: any) {
		self.postMessage({
			success: false,
			error: error.message || String(error)
		});
	}
}

runCheck();
export {};

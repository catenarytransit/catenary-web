import { clock_skew_store } from '../globalstores';

export async function checkClockSync(): Promise<{ offset: number | null; isSynchronized: boolean; error?: string }> {
	if (typeof window === 'undefined' || typeof Worker === 'undefined') {
		return { offset: null, isSynchronized: false, error: 'Web Workers are not supported in this environment' };
	}

	return new Promise((resolve) => {
		try {
			const worker = new Worker(
				new URL('./checkClockSync.worker.ts', import.meta.url),
				{ type: 'module' }
			);

			worker.onmessage = (event) => {
				const { success, result, error } = event.data;
				worker.terminate();

				if (success) {
					const { offset, isSynchronized, clientStart, clientEnd, serverTime, roundTripTime } = result;

					console.log(`Client Start Time: ${clientStart} ms`);
					console.log(`Client End Time: ${clientEnd} ms`);
					console.log(`Server Time Received: ${serverTime} ms`);
					console.log(`Round Trip Time: ${roundTripTime} ms`);
					console.log(`Estimated Offset: ${offset} ms`);

					if (isSynchronized) {
						console.log('Client clock appears to be reasonably synchronized with the server.');
					} else {
						console.log('Client clock appears to be significantly out of sync with the server.');
					}

					clock_skew_store.set(offset);
					resolve({ offset, isSynchronized });
				} else {
					console.error('Error checking clock synchronization in worker:', error);
					resolve({ offset: null, isSynchronized: false, error });
				}
			};

			worker.onerror = (err) => {
				console.error('Worker error in clock sync:', err);
				worker.terminate();
				resolve({ offset: null, isSynchronized: false, error: err.message });
			};
		} catch (err: any) {
			console.error('Failed to create worker for clock sync:', err);
			resolve({ offset: null, isSynchronized: false, error: err.message });
		}
	});
}

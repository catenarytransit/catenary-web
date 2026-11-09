import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadCompleteEdelweissPage, streamEdelweissPage } from './edelweissStreaming';

const response = (id: string) => ({
	itineraries: [{
		id, startTime: '2026-11-09T11:00:00Z',
		endTime: '2026-11-09T11:30:00Z', legs: [{ mode: 'BUS' }]
	}],
	direct: [],
	previousPageCursor: `earlier-${id}`,
	nextPageCursor: `later-${id}`
});

class FakeWebSocket {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static last: FakeWebSocket;
	readyState = FakeWebSocket.CONNECTING;
	onopen: (() => void) | null = null;
	onmessage: ((event: { data: string }) => void) | null = null;
	onerror: (() => void) | null = null;
	onclose: (() => void) | null = null;
	private id: string | null = null;

	constructor(_url: string) {
		FakeWebSocket.last = this;
		queueMicrotask(() => {
			this.readyState = FakeWebSocket.OPEN;
			this.onopen?.();
		});
	}

	send(command: string): void {
		this.id = (JSON.parse(command) as { requestId: string }).requestId;
	}

	emit(type: 'snapshot' | 'complete', id: string, sequence?: number): void {
		this.onmessage?.({
			data: JSON.stringify({
				type,
				requestId: this.id,
				...(sequence === undefined ? {} : { sequence }),
				response: response(id)
			})
		});
	}

	close(): void {
		this.readyState = 3;
	}
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('Completed earlier connection pages', () => {
	it('does not publish partial snapshots, and returns the authoritative complete page', async () => {
		vi.stubGlobal('WebSocket', FakeWebSocket);
		const controller = new AbortController();
		let resolved = false;
		const loading = loadCompleteEdelweissPage({}, 'earlier-1', controller.signal)
			.then(page => {
				resolved = true;
				return page;
			});
		await Promise.resolve(); // Simulate socket open and request send.
		const socket = FakeWebSocket.last;
		socket.emit('snapshot', 'partial-1', 1);
		socket.emit('snapshot', 'partial-2', 2);
		await Promise.resolve();
		expect(resolved).toBe(false);

		socket.emit('complete', 'final');
		const page = await loading;
		expect(page.itineraries.map(item => item.id)).toEqual(['final']);
		expect(page.previousPageCursor).toBe('earlier-final');
		expect(resolved).toBe(true);
	});

	it('preserves progressive snapshots for initial and later requests', async () => {
		vi.stubGlobal('WebSocket', FakeWebSocket);
		const observed: string[] = [];
		const loading = streamEdelweissPage({}, 'later-1', new AbortController().signal,
			page => { observed.push(page.itineraries[0].id ?? ''); });
		await Promise.resolve();
		const socket = FakeWebSocket.last;
		socket.emit('snapshot', 'partial', 1);
		expect(observed).toEqual(['partial']);
		socket.emit('complete', 'final');
		await loading;
		expect(observed).toEqual(['partial', 'final']);
	});

	it('does not display buffered partial journeys if the request is cancelled', async () => {
		vi.stubGlobal('WebSocket', FakeWebSocket);
		const controller = new AbortController();
		const loading = loadCompleteEdelweissPage({}, 'earlier-cancel', controller.signal);
		await Promise.resolve();
		FakeWebSocket.last.emit('snapshot', 'partial', 1);
		controller.abort();
		await expect(loading).rejects.toMatchObject({ name: 'AbortError' });
	});
});

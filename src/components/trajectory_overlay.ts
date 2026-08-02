import type { CustomLayerInterface, CustomRenderMethodInput, Map } from 'maplibre-gl';

const PROJECTION_BRIDGE_LAYER_ID = 'trajectory-overlay-projection-bridge';
const PROJECTION_SEND_INTERVAL_MS = 1000 / 30;

type OverlayState = 'idle' | 'starting' | 'ready' | 'failed';
type TrajectoryData = Record<string, { content: any[]; timestamp: number }>;

let overlayWorker: Worker | null = null;
let overlayCanvas: HTMLCanvasElement | null = null;
let activeMap: Map | null = null;
let overlayState: OverlayState = 'idle';
let lastShaderVariant = '';
let lastProjectionSentAt = 0;
let lastProjectionWidth = 0;
let lastProjectionHeight = 0;
let latestTrajectoryData: TrajectoryData = {};
let sentTrajectoryVersions = new Map<string, string>();
let removeVisibilityListener: (() => void) | null = null;
let removeStyleListener: (() => void) | null = null;
let removeMapListener: (() => void) | null = null;
let removeCameraListener: (() => void) | null = null;

function copyMatrix(matrix: ArrayLike<number>): number[] {
	return Array.from(matrix);
}

function trajectoryVersion(value: { content?: any[]; timestamp?: number } | undefined) {
	return `${value?.timestamp ?? 'none'}:${value?.content?.length ?? 0}`;
}

function flushTrajectoryData() {
	if (!overlayWorker || overlayState !== 'ready') return;

	const updates: TrajectoryData = {};
	const currentChateaus = new Set(Object.keys(latestTrajectoryData));
	const removals: string[] = [];

	for (const [chateau, value] of Object.entries(latestTrajectoryData)) {
		const version = trajectoryVersion(value);
		if (sentTrajectoryVersions.get(chateau) === version) continue;

		updates[chateau] = value;
		sentTrajectoryVersions.set(chateau, version);
	}

	for (const chateau of sentTrajectoryVersions.keys()) {
		if (currentChateaus.has(chateau)) continue;
		removals.push(chateau);
		sentTrajectoryVersions.delete(chateau);
	}

	if (Object.keys(updates).length === 0 && removals.length === 0) return;

	overlayWorker.postMessage({
		type: 'trajectory-patch',
		updates,
		removals
	});
}

function markOverlayFailed(message: string, details?: unknown) {
	if (overlayState === 'failed') return;

	overlayState = 'failed';
	console.error(`[trajectory overlay] ${message}`, details ?? '');
	overlayWorker?.terminate();
	overlayWorker = null;
	overlayCanvas?.remove();
	overlayCanvas = null;
}

function createProjectionBridge(map: Map): CustomLayerInterface {
	return {
		id: PROJECTION_BRIDGE_LAYER_ID,
		type: 'custom',
		renderingMode: '2d',
		render(_gl, args: CustomRenderMethodInput) {
			if (!overlayWorker || overlayState === 'failed') return;

			const now = performance.now();
			const mapCanvas = map.getCanvas();
			const shaderVariant = args.shaderData.variantName;
			const shaderChanged = shaderVariant !== lastShaderVariant;
			const dimensionsChanged =
				mapCanvas.width !== lastProjectionWidth || mapCanvas.height !== lastProjectionHeight;

			if (
				!shaderChanged &&
				!dimensionsChanged &&
				now - lastProjectionSentAt < PROJECTION_SEND_INTERVAL_MS
			) {
				return;
			}

			const shaderData = shaderChanged
				? {
						variantName: shaderVariant,
						vertexShaderPrelude: args.shaderData.vertexShaderPrelude,
						define: args.shaderData.define
					}
				: undefined;

			lastShaderVariant = shaderVariant;
			lastProjectionSentAt = now;
			lastProjectionWidth = mapCanvas.width;
			lastProjectionHeight = mapCanvas.height;

			overlayWorker.postMessage({
				type: 'projection',
				shaderVariant,
				shaderData,
				projectionData: {
					mainMatrix: copyMatrix(args.defaultProjectionData.mainMatrix),
					fallbackMatrix: copyMatrix(args.defaultProjectionData.fallbackMatrix),
					tileMercatorCoords: [...args.defaultProjectionData.tileMercatorCoords],
					clippingPlane: [...args.defaultProjectionData.clippingPlane],
					projectionTransition: args.defaultProjectionData.projectionTransition
				},
				width: mapCanvas.width,
				height: mapCanvas.height,
				pixelRatio: map.getPixelRatio(),
				zoom: map.getZoom(),
				moving: map.isMoving()
			});
		}
	};
}

function addProjectionBridge(map: Map) {
	if (!map.isStyleLoaded() || map.getLayer(PROJECTION_BRIDGE_LAYER_ID)) return;
	map.addLayer(createProjectionBridge(map));
	console.info('[trajectory overlay] projection bridge attached');
}

export function setupTrajectoryOverlay(map: Map) {
	destroyTrajectoryOverlay();

	if (
		typeof Worker === 'undefined' ||
		typeof OffscreenCanvas === 'undefined' ||
		typeof HTMLCanvasElement === 'undefined' ||
		!HTMLCanvasElement.prototype.transferControlToOffscreen
	) {
		overlayState = 'failed';
		console.warn('[trajectory overlay] OffscreenCanvas workers are unavailable; using MapLibre fallback');
		return false;
	}

	activeMap = map;
	overlayState = 'starting';
	lastShaderVariant = '';
	lastProjectionSentAt = 0;
	lastProjectionWidth = 0;
	lastProjectionHeight = 0;
	sentTrajectoryVersions.clear();
	console.info('[trajectory overlay] starting worker');

	const canvas = document.createElement('canvas');
	canvas.className = 'trajectory-overlay-canvas';
	canvas.setAttribute('aria-hidden', 'true');
	canvas.style.position = 'absolute';
	canvas.style.inset = '0';
	canvas.style.width = '100%';
	canvas.style.height = '100%';
	canvas.style.pointerEvents = 'none';
	canvas.style.zIndex = '1';
	map.getContainer().appendChild(canvas);
	overlayCanvas = canvas;

	const offscreenCanvas = canvas.transferControlToOffscreen();
	const worker = new Worker(new URL('./trajectory_overlay.worker.ts', import.meta.url), {
		type: 'module'
	});
	overlayWorker = worker;

	worker.onmessage = (event: MessageEvent) => {
		const message = event.data;

		switch (message?.type) {
			case 'ready':
				overlayState = 'ready';
				console.info('[trajectory overlay] worker ready', message.details);
				flushTrajectoryData();
				map.triggerRepaint();
				break;
			case 'shader-ready':
				console.info('[trajectory overlay] shader ready', message.variantName);
				break;
			case 'dataset':
				console.info('[trajectory overlay] dataset prepared', message.details);
				break;
			case 'stats':
				console.debug('[trajectory overlay] stats', message.details);
				break;
			case 'error':
				markOverlayFailed(message.message || 'worker error', message.details);
				break;
		}
	};

	worker.onerror = (event) => {
		markOverlayFailed('worker failed to load or execute', event.message);
	};
	worker.onmessageerror = (event) => {
		markOverlayFailed('worker message could not be decoded', event.data);
	};

	worker.postMessage(
		{
			type: 'init',
			canvas: offscreenCanvas,
			visible: document.visibilityState !== 'hidden'
		},
		[offscreenCanvas]
	);

	const onVisibilityChange = () => {
		overlayWorker?.postMessage({
			type: 'visibility',
			visible: document.visibilityState !== 'hidden'
		});
	};
	document.addEventListener('visibilitychange', onVisibilityChange);
	removeVisibilityListener = () => document.removeEventListener('visibilitychange', onVisibilityChange);

	const onStyleLoad = () => addProjectionBridge(map);
	map.on('style.load', onStyleLoad);
	map.on('load', onStyleLoad);
	removeStyleListener = () => {
		map.off('style.load', onStyleLoad);
		map.off('load', onStyleLoad);
	};

	const requestFinalProjection = () => map.triggerRepaint();
	map.on('moveend', requestFinalProjection);
	map.on('resize', requestFinalProjection);
	removeCameraListener = () => {
		map.off('moveend', requestFinalProjection);
		map.off('resize', requestFinalProjection);
	};

	const onMapRemove = () => destroyTrajectoryOverlay();
	map.on('remove', onMapRemove);
	removeMapListener = () => map.off('remove', onMapRemove);

	if (map.isStyleLoaded()) addProjectionBridge(map);

	return true;
}

export function isTrajectoryOverlayActive() {
	return overlayState === 'ready' && overlayWorker !== null;
}

export function setTrajectoryOverlayData(data: TrajectoryData) {
	latestTrajectoryData = data || {};
	flushTrajectoryData();
}

export function clearTrajectoryOverlayData() {
	latestTrajectoryData = {};
	flushTrajectoryData();
}

export function destroyTrajectoryOverlay() {
	removeVisibilityListener?.();
	removeVisibilityListener = null;
	removeStyleListener?.();
	removeStyleListener = null;
	removeCameraListener?.();
	removeCameraListener = null;
	removeMapListener?.();
	removeMapListener = null;

	if (activeMap) {
		try {
			if (activeMap.getLayer(PROJECTION_BRIDGE_LAYER_ID)) {
				activeMap.removeLayer(PROJECTION_BRIDGE_LAYER_ID);
			}
		} catch (error) {
			console.debug('[trajectory overlay] bridge layer was already removed', error);
		}
	}

	overlayWorker?.terminate();
	overlayWorker = null;
	overlayCanvas?.remove();
	overlayCanvas = null;
	activeMap = null;
	overlayState = 'idle';
	lastShaderVariant = '';
	lastProjectionSentAt = 0;
	lastProjectionWidth = 0;
	lastProjectionHeight = 0;
	latestTrajectoryData = {};
	sentTrajectoryVersions.clear();
}

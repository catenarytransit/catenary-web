import type { CustomLayerInterface, CustomRenderMethodInput, Map } from 'maplibre-gl';

const PROJECTION_BRIDGE_LAYER_ID = 'trajectory-overlay-projection-bridge';

let overlayWorker: Worker | null = null;
let overlayCanvas: HTMLCanvasElement | null = null;
let activeMap: Map | null = null;
let lastShaderVariant = '';
let removeVisibilityListener: (() => void) | null = null;
let removeStyleListener: (() => void) | null = null;
let removeMapListener: (() => void) | null = null;

function copyMatrix(matrix: ArrayLike<number>): number[] {
	return Array.from(matrix);
}

function createProjectionBridge(map: Map): CustomLayerInterface {
	return {
		id: PROJECTION_BRIDGE_LAYER_ID,
		type: 'custom',
		renderingMode: '2d',
		render(_gl, args: CustomRenderMethodInput) {
			if (!overlayWorker) return;

			const shaderVariant = args.shaderData.variantName;
			const shaderData =
				shaderVariant !== lastShaderVariant
					? {
							variantName: shaderVariant,
							vertexShaderPrelude: args.shaderData.vertexShaderPrelude,
							define: args.shaderData.define
						}
					: undefined;

			lastShaderVariant = shaderVariant;

			const mapCanvas = map.getCanvas();
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
				zoom: map.getZoom()
			});
		}
	};
}

function addProjectionBridge(map: Map) {
	if (!map.isStyleLoaded() || map.getLayer(PROJECTION_BRIDGE_LAYER_ID)) return;
	map.addLayer(createProjectionBridge(map));
}

export function setupTrajectoryOverlay(map: Map) {
	destroyTrajectoryOverlay();

	if (
		typeof Worker === 'undefined' ||
		typeof OffscreenCanvas === 'undefined' ||
		typeof HTMLCanvasElement === 'undefined' ||
		!HTMLCanvasElement.prototype.transferControlToOffscreen ||
		!new OffscreenCanvas(1, 1).getContext('webgl2')
	) {
		console.warn('[trajectory overlay] OffscreenCanvas workers are unavailable');
		return false;
	}

	activeMap = map;
	lastShaderVariant = '';

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

	const onMapRemove = () => destroyTrajectoryOverlay();
	map.on('remove', onMapRemove);
	removeMapListener = () => map.off('remove', onMapRemove);

	if (map.isStyleLoaded()) addProjectionBridge(map);

	return true;
}

export function isTrajectoryOverlayActive() {
	return overlayWorker !== null;
}

export function setTrajectoryOverlayData(data: Record<string, { content: any[]; timestamp: number }>) {
	overlayWorker?.postMessage({
		type: 'trajectories',
		data
	});
}

export function clearTrajectoryOverlayData() {
	overlayWorker?.postMessage({ type: 'trajectories', data: {} });
}

export function destroyTrajectoryOverlay() {
	removeVisibilityListener?.();
	removeVisibilityListener = null;
	removeStyleListener?.();
	removeStyleListener = null;
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
	lastShaderVariant = '';
}

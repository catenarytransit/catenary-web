import { get, writable, type Readable } from 'svelte/store';
import type maplibregl from 'maplibre-gl';

export type SidebarPosition = 'none' | 'middle' | 'full';

type ViewportMode = 'mobile' | 'desktop';

export interface SidebarViewState {
	position: SidebarPosition;
	height: string;
	heightPx: number;
	translateX: string;
	searchTranslateY: number;
	collapserLeft: string;
	collapserTop: string;
}

export interface SidebarController {
	state: Readable<SidebarViewState>;
	start(): () => void;
	setMapProvider(provider: () => maplibregl.Map | null): void;
	startDrag(event: MouseEvent | TouchEvent): void;
	toggle(): void;
	open(): void;
	recomputeMapPadding(): void;
	getGpsButtonBottomOffset(): string;
}

const DRAG_HANDLE_HEIGHT = 24;
const ANIMATION_DURATION_MS = 250;

function easeOutCubic(progress: number): number {
	return 1 - Math.pow(1 - progress, 3);
}

function interpolate(start: number, end: number, progress: number): number {
	return start + (end - start) * progress;
}

function getPointerY(event: MouseEvent | TouchEvent): number | null {
	if (event instanceof MouseEvent) {
		return event.clientY;
	}

	return event.touches[0]?.clientY ?? event.changedTouches[0]?.clientY ?? null;
}

function getViewportMode(): ViewportMode {
	return window.innerWidth < 768 ? 'mobile' : 'desktop';
}

function getMiddleHeight(): number {
	return window.innerHeight * (window.innerWidth >= 640 ? 0.55 : 0.33);
}

export function createSidebarController(): SidebarController {
	const state = writable<SidebarViewState>({
		position: 'middle',
		height: '100vh',
		heightPx: 40,
		translateX: '0px',
		searchTranslateY: 0,
		collapserLeft: '380px',
		collapserTop: '0px'
	});

	let mapProvider: () => maplibregl.Map | null = () => null;
	let viewportMode: ViewportMode = 'mobile';
	let animationFrame: number | null = null;
	let dragging = false;
	let dragStartY: number | null = null;
	let dragStartHeight = 0;
	let previousPointerY: number | null = null;
	let lastVelocity = 0;

	function setMapProvider(provider: () => maplibregl.Map | null): void {
		mapProvider = provider;
	}

	function cancelAnimation(): void {
		if (animationFrame !== null) {
			cancelAnimationFrame(animationFrame);
			animationFrame = null;
		}
	}

	function initializeForViewport(): void {
		viewportMode = getViewportMode();
		const desktopWidth = window.innerWidth >= 1280 ? 480 : 380;

		if (viewportMode === 'mobile') {
			const heightPx = getMiddleHeight();
			state.set({
				position: 'middle',
				height: `${heightPx}px`,
				heightPx,
				translateX: '0px',
				searchTranslateY: 0,
				collapserLeft: `${desktopWidth}px`,
				collapserTop: `${window.innerHeight / 2 - 15}px`
			});
			return;
		}

		state.set({
			position: 'full',
			height: '100vh',
			heightPx: window.innerHeight - DRAG_HANDLE_HEIGHT,
			translateX: '0px',
			searchTranslateY: 0,
			collapserLeft: `${desktopWidth}px`,
			collapserTop: `${window.innerHeight / 2 - 15}px`
		});
	}

	function recomputeMapPadding(): void {
		const map = mapProvider();
		const sidebar = document.getElementById('catenary-sidebar');
		if (!map || !sidebar) {
			return;
		}

		const current = get(state);
		if (window.innerWidth < 640) {
			const bottom =
				current.position === 'none'
					? 0
					: current.position === 'middle'
						? window.innerHeight / 2
						: sidebar.offsetHeight;
			map.easeTo({ padding: { bottom, left: 0 }, duration: 200 });
			return;
		}

		if (window.innerWidth < 768) {
			map.easeTo({ padding: { left: sidebar.offsetWidth, bottom: 0 }, duration: 200 });
			return;
		}

		map.easeTo({
			padding: { left: current.position === 'full' ? sidebar.offsetWidth : 0, bottom: 0 },
			duration: 200
		});
	}

	function animateTo(position: SidebarPosition): void {
		const sidebar = document.getElementById('catenary-sidebar');
		if (!sidebar) {
			state.update((current) => ({ ...current, position }));
			return;
		}

		cancelAnimation();
		const startedAt = performance.now();
		const current = get(state);

		if (getViewportMode() === 'mobile') {
			const startHeight = Math.min(window.innerHeight, Math.max(DRAG_HANDLE_HEIGHT, current.heightPx));
			const targetHeight =
				position === 'full'
					? window.innerHeight - DRAG_HANDLE_HEIGHT
					: position === 'none'
						? DRAG_HANDLE_HEIGHT
						: window.innerHeight * 0.55;
			const startSearchY = current.searchTranslateY;
			const targetSearchY = position === 'full' ? -50 : 0;

			const animate = (timestamp: number) => {
				const progress = Math.min((timestamp - startedAt) / ANIMATION_DURATION_MS, 1);
				const eased = easeOutCubic(progress);
				const heightPx = interpolate(startHeight, targetHeight, eased);

				state.set({
					...get(state),
					position,
					heightPx,
					height: `${heightPx}px`,
					translateX: '0px',
					searchTranslateY: interpolate(startSearchY, targetSearchY, eased)
				});

				if (progress < 1) {
					animationFrame = requestAnimationFrame(animate);
				} else {
					animationFrame = null;
					recomputeMapPadding();
				}
			};

			animationFrame = requestAnimationFrame(animate);
			return;
		}

		const sidebarWidth = sidebar.offsetWidth;
		const startX = Number.parseFloat(current.translateX) || 0;
		const targetX = position === 'none' ? -sidebarWidth : 0;
		const startCollapserLeft = Number.parseFloat(current.collapserLeft) || sidebarWidth;
		const targetCollapserLeft = position === 'none' ? 0 : sidebarWidth;

		const animate = (timestamp: number) => {
			const progress = Math.min((timestamp - startedAt) / ANIMATION_DURATION_MS, 1);
			const eased = easeOutCubic(progress);
			const translateX = interpolate(startX, targetX, eased);
			const collapserLeft = interpolate(startCollapserLeft, targetCollapserLeft, eased);

			state.set({
				...get(state),
				position,
				height: '100vh',
				heightPx: window.innerHeight - DRAG_HANDLE_HEIGHT,
				translateX: `${translateX}px`,
				searchTranslateY: 0,
				collapserLeft: `${collapserLeft}px`
			});

			if (progress < 1) {
				animationFrame = requestAnimationFrame(animate);
			} else {
				animationFrame = null;
				recomputeMapPadding();
			}
		};

		animationFrame = requestAnimationFrame(animate);
	}

	function startDrag(event: MouseEvent | TouchEvent): void {
		const pointerY = getPointerY(event);
		const sidebar = document.getElementById('catenary-sidebar');
		if (pointerY === null || !sidebar || getViewportMode() !== 'mobile') {
			return;
		}

		cancelAnimation();
		dragging = true;
		dragStartY = pointerY;
		dragStartHeight = sidebar.offsetHeight;
		previousPointerY = pointerY;
		lastVelocity = 0;
	}

	function handlePointerMove(event: MouseEvent | TouchEvent): void {
		if (!dragging || dragStartY === null || getViewportMode() !== 'mobile') {
			return;
		}

		const pointerY = getPointerY(event);
		if (pointerY === null) {
			return;
		}

		lastVelocity = previousPointerY === null ? 0 : pointerY - previousPointerY;
		previousPointerY = pointerY;
		const heightPx = Math.min(
			window.innerHeight - DRAG_HANDLE_HEIGHT,
			Math.max(DRAG_HANDLE_HEIGHT, dragStartHeight + dragStartY - pointerY - lastVelocity)
		);
		const projectedY = pointerY + 10 * lastVelocity;
		const position: SidebarPosition =
			projectedY > 0.7 * window.innerHeight
				? 'none'
				: projectedY < 0.3 * window.innerHeight
					? 'full'
					: 'middle';

		state.update((current) => ({
			...current,
			position,
			heightPx,
			height: `${heightPx}px`
		}));
	}

	function finishDrag(): void {
		if (!dragging) {
			return;
		}

		dragging = false;
		dragStartY = null;
		previousPointerY = null;
		animateTo(get(state).position);
	}

	function handleResize(): void {
		const nextMode = getViewportMode();
		const current = get(state);
		const desktopWidth = window.innerWidth >= 1280 ? 480 : 380;
		let position = current.position;

		if (nextMode !== viewportMode) {
			if (nextMode === 'mobile' && position === 'full') {
				position = 'middle';
			} else if (nextMode === 'desktop' && position === 'middle') {
				position = 'full';
			}
		}

		viewportMode = nextMode;
		state.update((value) => ({
			...value,
			position,
			collapserTop: `${window.innerHeight / 2 - 15}px`,
			collapserLeft: position === 'none' ? '0px' : `${desktopWidth}px`,
			height: nextMode === 'desktop' ? '100vh' : value.height,
			heightPx: nextMode === 'desktop' ? window.innerHeight - DRAG_HANDLE_HEIGHT : value.heightPx
		}));
		animateTo(position);
	}

	function start(): () => void {
		initializeForViewport();

		window.addEventListener('resize', handleResize);
		window.addEventListener('mousemove', handlePointerMove);
		window.addEventListener('touchmove', handlePointerMove, { passive: true });
		window.addEventListener('mouseup', finishDrag);
		window.addEventListener('touchend', finishDrag);

		return () => {
			cancelAnimation();
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('mousemove', handlePointerMove);
			window.removeEventListener('touchmove', handlePointerMove);
			window.removeEventListener('mouseup', finishDrag);
			window.removeEventListener('touchend', finishDrag);
		};
	}

	function toggle(): void {
		animateTo(get(state).position === 'full' ? 'none' : 'full');
	}

	function open(): void {
		const current = get(state).position;
		if (current === 'full') {
			return;
		}
		animateTo(getViewportMode() === 'mobile' ? 'middle' : 'full');
	}

	function getGpsButtonBottomOffset(): string {
		if (typeof window === 'undefined' || window.innerWidth >= 640) {
			return '32px';
		}

		const sidebar = document.getElementById('catenary-sidebar');
		const sidebarHeight = sidebar?.offsetHeight ?? get(state).heightPx;
		return `${32 - DRAG_HANDLE_HEIGHT + sidebarHeight}px`;
	}

	return {
		state: { subscribe: state.subscribe },
		start,
		setMapProvider,
		startDrag,
		toggle,
		open,
		recomputeMapPadding,
		getGpsButtonBottomOffset
	};
}

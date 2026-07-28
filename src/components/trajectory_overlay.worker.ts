/// <reference lib="webworker" />

export {};

type ShaderDescription = {
	variantName: string;
	vertexShaderPrelude: string;
	define: string;
};

type ProjectionData = {
	mainMatrix: number[];
	fallbackMatrix: number[];
	tileMercatorCoords: [number, number, number, number];
	clippingPlane: [number, number, number, number];
	projectionTransition: number;
};

type PreparedTrajectory = {
	mercatorCoordinates: Float32Array;
	cumulativeLengths: Float64Array;
	totalLength: number;
	departure: number;
	arrival: number;
	color: [number, number, number, number];
	routeType: number;
};

type ProgramState = {
	program: WebGLProgram;
	positionLocation: number;
	colorLocation: number;
	sizeLocation: number;
	mainMatrixLocation: WebGLUniformLocation | null;
	fallbackMatrixLocation: WebGLUniformLocation | null;
	tileMercatorCoordsLocation: WebGLUniformLocation | null;
	clippingPlaneLocation: WebGLUniformLocation | null;
	projectionTransitionLocation: WebGLUniformLocation | null;
};

const FLOATS_PER_POINT = 7;
const MAX_MERCATOR_LATITUDE = 85.0511287798066;

let canvas: OffscreenCanvas | null = null;
let gl: WebGL2RenderingContext | null = null;
let pointBuffer: WebGLBuffer | null = null;
let preparedTrajectories: PreparedTrajectory[] = [];
let projectionData: ProjectionData | null = null;
let currentShaderVariant = '';
let currentZoom = 0;
let pixelRatio = 1;
let visible = true;
let pointData = new Float32Array(0);
let programs = new Map<string, ProgramState>();

function mercatorXFromLng(lng: number) {
	return (lng + 180) / 360;
}

function mercatorYFromLat(lat: number) {
	const clampedLatitude = Math.max(-MAX_MERCATOR_LATITUDE, Math.min(MAX_MERCATOR_LATITUDE, lat));
	const radians = (clampedLatitude * Math.PI) / 180;
	return (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2;
}

function resolveRouteType(trajectory: any): number {
	if (typeof trajectory.route_type === 'number') return trajectory.route_type;

	switch (trajectory.mode) {
		case 'tram':
		case 'cable_car':
		case 'funicular':
			return 0;
		case 'subway':
		case 'metro':
			return 1;
		case 'rail':
			return 2;
		case 'bus':
		case 'trolleybus':
			return 3;
		case 'ferry':
			return 4;
		default:
			return 3;
	}
}

function parseColor(value: unknown): [number, number, number, number] {
	if (typeof value !== 'string') return [0.667, 0.667, 0.667, 0.72];

	let hex = value.trim().replace(/^#/, '');
	if (hex.length === 3 || hex.length === 4) {
		hex = hex
			.split('')
			.map((character) => character + character)
			.join('');
	}

	if (hex.length !== 6 && hex.length !== 8) return [0.667, 0.667, 0.667, 0.72];

	const numeric = Number.parseInt(hex, 16);
	if (!Number.isFinite(numeric)) return [0.667, 0.667, 0.667, 0.72];

	if (hex.length === 8) {
		return [
			((numeric >>> 24) & 0xff) / 255,
			((numeric >>> 16) & 0xff) / 255,
			((numeric >>> 8) & 0xff) / 255,
			(numeric & 0xff) / 255
		];
	}

	return [((numeric >>> 16) & 0xff) / 255, ((numeric >>> 8) & 0xff) / 255, (numeric & 0xff) / 255, 0.72];
}

function interpolateStops(stops: number[], zoom: number) {
	if (zoom <= stops[0]) return stops[1];

	for (let index = 2; index < stops.length; index += 2) {
		const nextZoom = stops[index];
		const nextValue = stops[index + 1];
		const previousZoom = stops[index - 2];
		const previousValue = stops[index - 1];

		if (zoom <= nextZoom) {
			const progress = (zoom - previousZoom) / Math.max(1e-6, nextZoom - previousZoom);
			return previousValue + (nextValue - previousValue) * progress;
		}
	}

	return stops[stops.length - 1];
}

function radiusForRouteType(routeType: number, zoom: number) {
	if (routeType === 3 || routeType === 11) {
		return interpolateStops([7, 1, 8, 1.2, 9, 1.5, 10, 2, 16, 6], zoom);
	}
	if (routeType === 0 || routeType === 5) {
		return interpolateStops([6, 1.8, 8, 2.3, 10, 4, 11, 4.5, 13, 6, 15, 6, 16, 10], zoom);
	}
	if (routeType === 1 || routeType === 7) {
		return interpolateStops([6, 3, 8, 3, 10, 4, 11, 6, 16, 12], zoom);
	}
	if (routeType === 2) {
		return interpolateStops([1, 1, 3, 2.5, 6, 2.8, 8, 4, 11, 6, 16, 10], zoom);
	}
	return interpolateStops([8, 5, 10, 6, 16, 10], zoom);
}

function prepareTrajectory(rawTrajectory: any): PreparedTrajectory | null {
	if (
		!rawTrajectory ||
		!Array.isArray(rawTrajectory.stops) ||
		rawTrajectory.stops.length === 0 ||
		!Array.isArray(rawTrajectory.segments) ||
		rawTrajectory.segments.length === 0
	) {
		return null;
	}

	const departure = new Date(rawTrajectory.stops[0].departure).getTime();
	const arrival = new Date(rawTrajectory.stops[rawTrajectory.stops.length - 1].arrival).getTime();
	if (!Number.isFinite(departure) || !Number.isFinite(arrival) || arrival <= departure) return null;

	const coordinates: number[][] = [];
	for (const segment of rawTrajectory.segments) {
		if (!Array.isArray(segment?.coordinates)) continue;
		for (const coordinate of segment.coordinates) {
			if (
				Array.isArray(coordinate) &&
				coordinate.length >= 2 &&
				Number.isFinite(coordinate[0]) &&
				Number.isFinite(coordinate[1])
			) {
				coordinates.push(coordinate);
			}
		}
	}

	if (coordinates.length === 0) return null;

	const mercatorCoordinates = new Float32Array(coordinates.length * 2);
	const cumulativeLengths = new Float64Array(coordinates.length);
	let totalLength = 0;

	for (let index = 0; index < coordinates.length; index += 1) {
		const coordinate = coordinates[index];
		mercatorCoordinates[index * 2] = mercatorXFromLng(coordinate[0]);
		mercatorCoordinates[index * 2 + 1] = mercatorYFromLat(coordinate[1]);

		if (index > 0) {
			const previous = coordinates[index - 1];
			const dx = coordinate[0] - previous[0];
			const dy = coordinate[1] - previous[1];
			totalLength += Math.sqrt(dx * dx + dy * dy);
		}
		cumulativeLengths[index] = totalLength;
	}

	return {
		mercatorCoordinates,
		cumulativeLengths,
		totalLength,
		departure,
		arrival,
		color: parseColor(rawTrajectory.color),
		routeType: resolveRouteType(rawTrajectory)
	};
}

function prepareTrajectories(data: Record<string, { content?: any[] }>) {
	const nextTrajectories: PreparedTrajectory[] = [];

	for (const chateauData of Object.values(data || {})) {
		if (!Array.isArray(chateauData?.content)) continue;

		for (const wrapper of chateauData.content) {
			const prepared = prepareTrajectory(wrapper?.content);
			if (prepared) nextTrajectories.push(prepared);
		}
	}

	preparedTrajectories = nextTrajectories;
}

function findSegment(cumulativeLengths: Float64Array, targetLength: number) {
	let low = 1;
	let high = cumulativeLengths.length - 1;

	while (low < high) {
		const middle = (low + high) >>> 1;
		if (cumulativeLengths[middle] < targetLength) {
			low = middle + 1;
		} else {
			high = middle;
		}
	}

	return low;
}

function ensurePointCapacity(pointCount: number) {
	const requiredFloats = pointCount * FLOATS_PER_POINT;
	if (pointData.length >= requiredFloats) return;

	let nextLength = Math.max(FLOATS_PER_POINT * 256, pointData.length || 0);
	while (nextLength < requiredFloats) nextLength *= 2;
	pointData = new Float32Array(nextLength);
}

function fillPointData(now: number) {
	ensurePointCapacity(preparedTrajectories.length);
	let pointCount = 0;

	for (const trajectory of preparedTrajectories) {
		if (now < trajectory.departure - 30000 || now > trajectory.arrival + 30000) continue;

		const progress = Math.max(
			0,
			Math.min(1, (now - trajectory.departure) / (trajectory.arrival - trajectory.departure))
		);
		const targetLength = progress * trajectory.totalLength;
		let x: number;
		let y: number;

		if (trajectory.mercatorCoordinates.length === 2 || trajectory.totalLength === 0) {
			x = trajectory.mercatorCoordinates[0];
			y = trajectory.mercatorCoordinates[1];
		} else {
			const endIndex = findSegment(trajectory.cumulativeLengths, targetLength);
			const startIndex = Math.max(0, endIndex - 1);
			const startLength = trajectory.cumulativeLengths[startIndex];
			const endLength = trajectory.cumulativeLengths[endIndex];
			const segmentProgress =
				endLength > startLength ? (targetLength - startLength) / (endLength - startLength) : 0;
			const startX = trajectory.mercatorCoordinates[startIndex * 2];
			const startY = trajectory.mercatorCoordinates[startIndex * 2 + 1];
			const endX = trajectory.mercatorCoordinates[endIndex * 2];
			const endY = trajectory.mercatorCoordinates[endIndex * 2 + 1];
			x = startX + (endX - startX) * segmentProgress;
			y = startY + (endY - startY) * segmentProgress;
		}

		const offset = pointCount * FLOATS_PER_POINT;
		pointData[offset] = x;
		pointData[offset + 1] = y;
		pointData[offset + 2] = trajectory.color[0];
		pointData[offset + 3] = trajectory.color[1];
		pointData[offset + 4] = trajectory.color[2];
		pointData[offset + 5] = trajectory.color[3];
		pointData[offset + 6] = radiusForRouteType(trajectory.routeType, currentZoom) * 2 * pixelRatio;
		pointCount += 1;
	}

	return pointCount;
}

function compileShader(type: number, source: string) {
	if (!gl) return null;
	const shader = gl.createShader(type);
	if (!shader) return null;

	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error('[trajectory overlay] shader compilation failed', gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}

	return shader;
}

function createProgram(shaderDescription: ShaderDescription): ProgramState | null {
	if (!gl) return null;

	const vertexSource = `#version 300 es
${shaderDescription.vertexShaderPrelude}
${shaderDescription.define}

in vec2 a_pos;
in vec4 a_color;
in float a_size;
out vec4 v_color;

void main() {
	gl_Position = projectTile(a_pos);
	gl_PointSize = a_size;
	v_color = a_color;
}`;

	const fragmentSource = `#version 300 es
precision mediump float;

in vec4 v_color;
out vec4 fragColor;

void main() {
	vec2 centered = gl_PointCoord * 2.0 - 1.0;
	float distanceSquared = dot(centered, centered);
	if (distanceSquared > 1.0) discard;

	float borderMix = smoothstep(0.62, 0.88, distanceSquared);
	float edgeAlpha = 1.0 - smoothstep(0.88, 1.0, distanceSquared);
	vec3 borderColor = vec3(0.23);
	vec3 color = mix(v_color.rgb, borderColor, borderMix);
	fragColor = vec4(color, v_color.a * edgeAlpha);
}`;

	const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
	const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
	if (!vertexShader || !fragmentShader) return null;

	const program = gl.createProgram();
	if (!program) return null;
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	gl.deleteShader(vertexShader);
	gl.deleteShader(fragmentShader);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error('[trajectory overlay] program link failed', gl.getProgramInfoLog(program));
		gl.deleteProgram(program);
		return null;
	}

	return {
		program,
		positionLocation: gl.getAttribLocation(program, 'a_pos'),
		colorLocation: gl.getAttribLocation(program, 'a_color'),
		sizeLocation: gl.getAttribLocation(program, 'a_size'),
		mainMatrixLocation: gl.getUniformLocation(program, 'u_projection_matrix'),
		fallbackMatrixLocation: gl.getUniformLocation(program, 'u_projection_fallback_matrix'),
		tileMercatorCoordsLocation: gl.getUniformLocation(program, 'u_projection_tile_mercator_coords'),
		clippingPlaneLocation: gl.getUniformLocation(program, 'u_projection_clipping_plane'),
		projectionTransitionLocation: gl.getUniformLocation(program, 'u_projection_transition')
	};
}

function getProgram(shaderDescription?: ShaderDescription) {
	if (shaderDescription && !programs.has(shaderDescription.variantName)) {
		const program = createProgram(shaderDescription);
		if (program) programs.set(shaderDescription.variantName, program);
	}
	return programs.get(currentShaderVariant) || null;
}

function setProjectionUniforms(program: ProgramState) {
	if (!gl || !projectionData) return;

	if (program.mainMatrixLocation) {
		gl.uniformMatrix4fv(program.mainMatrixLocation, false, projectionData.mainMatrix);
	}
	if (program.fallbackMatrixLocation) {
		gl.uniformMatrix4fv(program.fallbackMatrixLocation, false, projectionData.fallbackMatrix);
	}
	if (program.tileMercatorCoordsLocation) {
		gl.uniform4fv(program.tileMercatorCoordsLocation, projectionData.tileMercatorCoords);
	}
	if (program.clippingPlaneLocation) {
		gl.uniform4fv(program.clippingPlaneLocation, projectionData.clippingPlane);
	}
	if (program.projectionTransitionLocation) {
		gl.uniform1f(program.projectionTransitionLocation, projectionData.projectionTransition);
	}
}

function draw() {
	if (!visible || !canvas || !gl || !pointBuffer || !projectionData) return;

	const program = programs.get(currentShaderVariant);
	if (!program) return;

	const pointCount = fillPointData(Date.now());
	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT);
	if (pointCount === 0) return;

	gl.useProgram(program.program);
	setProjectionUniforms(program);
	gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		pointData.subarray(0, pointCount * FLOATS_PER_POINT),
		gl.DYNAMIC_DRAW
	);

	const stride = FLOATS_PER_POINT * Float32Array.BYTES_PER_ELEMENT;
	gl.enableVertexAttribArray(program.positionLocation);
	gl.vertexAttribPointer(program.positionLocation, 2, gl.FLOAT, false, stride, 0);
	gl.enableVertexAttribArray(program.colorLocation);
	gl.vertexAttribPointer(
		program.colorLocation,
		4,
		gl.FLOAT,
		false,
		stride,
		2 * Float32Array.BYTES_PER_ELEMENT
	);
	gl.enableVertexAttribArray(program.sizeLocation);
	gl.vertexAttribPointer(
		program.sizeLocation,
		1,
		gl.FLOAT,
		false,
		stride,
		6 * Float32Array.BYTES_PER_ELEMENT
	);

	gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	gl.drawArrays(gl.POINTS, 0, pointCount);
}

function scheduleNextFrame() {
	const workerScope = self as DedicatedWorkerGlobalScope & {
		requestAnimationFrame?: (callback: FrameRequestCallback) => number;
	};

	if (workerScope.requestAnimationFrame) {
		workerScope.requestAnimationFrame(renderLoop);
	} else {
		setTimeout(() => renderLoop(performance.now()), 1000 / 30);
	}
}

function renderLoop(_timestamp: number) {
	draw();
	scheduleNextFrame();
}

self.onmessage = (event: MessageEvent) => {
	const message = event.data;

	switch (message.type) {
		case 'init': {
			canvas = message.canvas;
			visible = message.visible !== false;
			gl = canvas?.getContext('webgl2', {
				alpha: true,
				antialias: false,
				depth: false,
				desynchronized: true,
				powerPreference: 'high-performance',
				premultipliedAlpha: false
			}) as WebGL2RenderingContext | null;

			if (!gl) {
				console.error('[trajectory overlay] WebGL2 is unavailable in the worker');
				return;
			}

			pointBuffer = gl.createBuffer();
			scheduleNextFrame();
			break;
		}
		case 'projection': {
			if (!canvas || !gl) return;
			if (canvas.width !== message.width || canvas.height !== message.height) {
				canvas.width = Math.max(1, message.width);
				canvas.height = Math.max(1, message.height);
			}
			pixelRatio = Math.max(0.25, message.pixelRatio || 1);
			currentZoom = message.zoom || 0;
			projectionData = message.projectionData;
			currentShaderVariant = message.shaderVariant;
			getProgram(message.shaderData);
			break;
		}
		case 'trajectories':
			prepareTrajectories(message.data || {});
			break;
		case 'visibility':
			visible = message.visible !== false;
			break;
	}
};

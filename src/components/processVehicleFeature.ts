import { componentToHex } from '../geoMathsAssist';
import { titleCase } from '../utils/titleCase';
import { get } from 'svelte/store';
import { hexToRgb, brightenForDarkModeKeepSat } from '../utils/colour';
import { calculateGamma } from './colour/computeBrightness';
import { fixHeadsignText, fixRouteName } from './agencyspecific';
import { adjustGamma } from './colour/readjustGamma';
import { occupancy_to_symbol } from './occupancy_to_symbol';
import { _ } from 'svelte-i18n';
import type {
	AspenisedVehiclePositionOutput,
	PositionedVehicle,
	PostgresRoute
} from '$lib/types/backend/common';

function translate(key: string, options?: Record<string, unknown>): string {
	return get(_)(key, options);
}

function getVehicleLabel(vehicle_data: AspenisedVehiclePositionOutput, chateau_id: string): string {
	let vehiclelabel = vehicle_data.vehicle?.label || vehicle_data.vehicle?.id || '';

	if (chateau_id === 'new-south-wales' && vehiclelabel.includes(' to ')) {
		vehiclelabel = vehicle_data.vehicle?.id || '';
	}

	return vehiclelabel.replace('ineo-tram:', '').replace('ineo-bus:', '');
}

export function getTripInfo(vehicle_data: AspenisedVehiclePositionOutput, chateau_id: string) {
	let tripIdLabel = '';
	let trip_short_name: string | null = null;
	let headsign = '';

	if (vehicle_data.trip) {
		if (vehicle_data.trip.trip_short_name) {
			tripIdLabel = vehicle_data.trip.trip_short_name;
			trip_short_name = vehicle_data.trip.trip_short_name;
		} else if (chateau_id === 'metra') {
			const split = vehicle_data.trip.trip_id?.split('_');
			if (split?.[1] != null) {
				tripIdLabel = split[1].replace(/\D/g, '');
			}
		}

		if (vehicle_data.trip.trip_headsign) {
			headsign = vehicle_data.trip.trip_headsign;
			if (headsign === headsign.toUpperCase()) {
				headsign = titleCase(headsign);
			}
			if (chateau_id === 'new-south-wales') {
				headsign = headsign.replace(' Station', '');
			}
		}
	}

	if (headsign.includes('Line  - ') && chateau_id === 'metro~losangeles') {
		headsign = headsign.split('-')[1].trim();
	}

	return { tripIdLabel, trip_short_name, headsign };
}

export function getRouteInfo(
	routeId: string | null | undefined,
	chateau_id: string,
	chateau_route_cache: Record<string, PostgresRoute> | undefined
) {
	let colour = '#aaaaaa';
	let text_colour = '#000000';
	let maptag = '';
	let route_short_name: string | null = null;
	let route_long_name: string | null = null;

	if (routeId && chateau_route_cache) {
		const route = chateau_route_cache[routeId];
		if (route) {
			route_long_name = route.long_name;
			route_short_name = route.short_name;
			maptag = route.short_name || route.long_name || '';
			colour = route.color || '#aaaaaa';
			text_colour = route.text_color || '#000000';

			switch (maptag) {
				case 'Metro E Line':
					maptag = 'E';
					break;
				case 'Metro A Line':
					maptag = 'A';
					break;
				case 'Metro B Line':
					maptag = 'B';
					break;
				case 'Metro C Line':
					maptag = 'C';
					break;
				case 'Metro D Line':
					maptag = 'D';
					break;
				case 'Metro L Line':
					maptag = 'L';
					break;
				case 'Metro K Line':
					maptag = 'K';
					break;
				case 'Metrolink Ventura County Line':
					maptag = 'Ventura';
					break;
				case 'Metrolink Antelope Valley Line':
					maptag = 'Antelope';
					break;
				case 'Metrolink San Bernardino Line':
					maptag = 'SB';
					break;
				case 'Metrolink Riverside Line':
					maptag = 'Riverside';
					break;
				case 'Metrolink Orange County Line':
					maptag = 'Orange';
					break;
				case 'Metrolink 91/Perris Valley Line':
					maptag = '91/Perris';
					break;
				case 'Metrolink Inland Empire-Orange County Line':
					maptag = 'IE-OC';
					break;
			}
		}
	}

	return { colour, text_colour, maptag, route_short_name, route_long_name };
}

export function getContrastColours(colour: string, darkMode: boolean) {
	let contrastdarkmode = colour;
	let contrastdarkmodebearing = colour;
	let contrastlightmode = colour;

	if (colour && darkMode === false) {
		let rgb = hexToRgb(colour);
		const gamma = calculateGamma(rgb.r, rgb.g, rgb.b);
		if (gamma > 0.55) {
			const [r, g, b] = adjustGamma([rgb.r, rgb.g, rgb.b], 0.55);
			rgb = { r, g, b };
		}
		contrastlightmode = `#${componentToHex(rgb.r)}${componentToHex(rgb.g)}${componentToHex(rgb.b)}`;
	}

	if (colour && darkMode === true) {
		const rgb = hexToRgb(colour);
		if (rgb != null) {
			const newdarkrgb = brightenForDarkModeKeepSat(rgb, 0.5);
			const newdarkbearingline = brightenForDarkModeKeepSat(rgb, 0.3);

			contrastdarkmode = `#${componentToHex(newdarkrgb.r)}${componentToHex(newdarkrgb.g)}${componentToHex(newdarkrgb.b)}`;
			contrastdarkmodebearing = `#${componentToHex(newdarkbearingline.r)}${componentToHex(newdarkbearingline.g)}${componentToHex(newdarkbearingline.b)}`;
		}
	}

	return { contrastdarkmode, contrastdarkmodebearing, contrastlightmode };
}

export function makeDelayLabel(delay: number): string {
	const prefix = delay < 0 ? '-' : '+';
	const abs_delay = Math.abs(delay);
	const minutes = Math.floor(abs_delay / 60);
	const hours = Math.floor(minutes / 60);
	return `${prefix}${hours > 0 ? `${hours}h` : ''}${minutes % 60}m`;
}

export function processVehicleFeature(
	rt_id: string,
	vehicle_data: PositionedVehicle,
	chateau_id: string,
	route_cache_data: Record<string, Record<string, PostgresRoute>>,
	darkMode: boolean,
	usunits: boolean
): GeoJSON.Feature<GeoJSON.Point> {
	const vehiclelabel = getVehicleLabel(vehicle_data, chateau_id);
	const { tripIdLabel, trip_short_name, headsign } = getTripInfo(vehicle_data, chateau_id);
	const routeId = vehicle_data.trip?.route_id;
	const chateau_route_cache = route_cache_data[chateau_id];
	const { colour, text_colour, maptag, route_short_name, route_long_name } = getRouteInfo(
		routeId,
		chateau_id,
		chateau_route_cache
	);
	const { contrastdarkmode, contrastdarkmodebearing, contrastlightmode } = getContrastColours(
		colour,
		darkMode
	);

	let speedstr = '';
	if (typeof vehicle_data.position.speed === 'number') {
		speedstr = usunits
			? `${(vehicle_data.position.speed * 2.23694).toFixed(1)} ᵐᵖʰ`
			: `${(vehicle_data.position.speed * 3.6).toFixed(1)} ㎞/ʰ`;
	}

	const delay = vehicle_data.trip?.delay;
	const delay_label = typeof delay === 'number' ? makeDelayLabel(delay) : '';
	const feature_id = `${chateau_id}_${routeId || ''}_${tripIdLabel}_${vehiclelabel || rt_id}`;

	return {
		type: 'Feature',
		id: feature_id,
		properties: {
			vehicleIdLabel: vehiclelabel,
			speed: speedstr,
			color: colour,
			chateau: chateau_id,
			route_type: vehicle_data.route_type,
			tripIdLabel,
			bearing: vehicle_data.position.bearing,
			has_bearing: vehicle_data.position.bearing != null,
			maptag: (fixRouteName(chateau_id, maptag, routeId || '') || '')
				.replace(' Branch', '')
				.replace(' Line', '')
				.replace('Counterclockwise', 'ACW')
				.replace('Clockwise', 'CW'),
			trip_short_name,
			route_short_name,
			route_long_name,
			contrastdarkmode,
			contrastdarkmodebearing,
			contrastlightmode,
			routeId,
			headsign: (fixHeadsignText(headsign, maptag) || '')
				.replace('Counterclockwise', translate('anticlockwise_abbrievation'))
				.replace('Clockwise', translate('clockwise_abbrievation')),
			timestamp: vehicle_data.timestamp,
			text_color: text_colour,
			trip_id: vehicle_data.trip?.trip_id,
			start_time: vehicle_data.trip?.start_time,
			start_date: vehicle_data.trip?.start_date,
			crowd_symbol: occupancy_to_symbol(vehicle_data.occupancy_status),
			occupancy_status: vehicle_data.occupancy_status,
			delay_label,
			delay
		},
		geometry: {
			type: 'Point',
			coordinates: [vehicle_data.position.longitude, vehicle_data.position.latitude]
		}
	};
}

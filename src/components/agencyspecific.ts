import { get } from 'svelte/store';
import { titleCase } from '../utils/titleCase';
import { _ } from 'svelte-i18n';

function translate(key: string, options?: Record<string, any>): string {
	return get(_)(key, options);
}

export function fixHeadsignIcon(headsign: string): string | null {
	let fixPatterns = {
		Airport: 'flight',
		"O'Hare": 'flight',
		Midway: 'flight'
	};

	// @ts-ignore
	if (fixPatterns[headsign]) {
		// @ts-ignore
		return fixPatterns[headsign] || null;
	}
	return null;
}

export function fixRouteName(chateau: string, route: string, rid: string): string {
	let fixPatterns = {
		'san-diego-mts': {
			'510': 'Blue Line',
			'520': 'Orange Line',
			'530': 'Green Line',
			'535': 'Copper Line'
		}
	};

	// @ts-ignore
	if (fixPatterns[chateau]) {
		// @ts-ignore
		return fixPatterns[chateau][rid] || fixPatterns[chateau]['*'] || route;
	} else {
		route = (route || '')
			.replace('Counterclockwise', translate('anticlockwise_abbrievation'))
			.replace('Clockwise', translate('clockwise_abbrievation'));

		return route;
	}
}

export function fixRouteIcon(chateau: string, rid: string): string | null {
	console.log(chateau, rid);
	let fixPatterns = {
		'san-diego-mts': {
			'510': '/lines/san-diego-mts/BLU.svg',
			'520': '/lines/san-diego-mts/ORG.svg',
			'530': '/lines/san-diego-mts/GRN.svg'
		}
	};

	// @ts-ignore
	if (fixPatterns[chateau]) {
		// @ts-ignore
		return fixPatterns[chateau][rid] || fixPatterns[chateau]['*'] || null;
	} else {
		return null;
	}
}

export function fixRouteNameLong(chateau: string, route: string, rid: string): string {
	const fixPatterns: Record<string, Record<string, string>> = {
		'san-diego-mts': {
			'3': 'Ocean View',
			'4': 'Imperial',
			'5': 'Market',
			'12': 'Skyline',
			'20': 'Highway 163 Express',
			'992': 'Airport',
			'30': 'La Jolla Village',
			'215': 'Mid-City Rapid',
			'225': 'South Bay Rapid',
			'235': 'I-15 Rapid',
			'201': 'SuperLoop',
			'202': 'SuperLoop',
			'204': 'SuperLoop',
			'227': 'Iris Rapid',
			'237': 'Mira Mesa Rapid',
			'280': 'Rapid Express',
			'290': 'Rapid Express',
			'530': 'El Cajon - 12th & Imperial',
			'535': 'East County Connector'
		}
	};

	if (chateau == 'metrolinktrains') {
		return route.replace('Metrolink ', '').replace(' Line', '');
	}

	if (fixPatterns[chateau]) {
		return (
			fixPatterns[chateau][rid] ||
			fixPatterns[chateau]['*'] ||
			route.replace('Counterclockwise', 'Anticlockwise')
		);
	} else {
		return route
			.replace('Transit Station', 'Sta')
			.replace('Station', 'Sta')
			.replace('Transportation Center', 'TC')
			.replace('Transit Center', 'TC')
			.replace('Transit Ctr', 'TC')
			.replace('Counterclockwise', translate('anticlockwise'))
			.replace('Clockwise', translate('clockwise'))
			.trim();
	}
}

export function fixRunNumber(
	chateau: string,
	type: number,
	route: number,
	tripname: string | null,
	vehicle: string,
	trip_id: string | null
): string | null {
	if (
		chateau == 'san-diego-mts' &&
		route.toString().length == 3 &&
		route.toString().startsWith('5')
	)
		return vehicle;
	if (chateau == 'northcountytransitdistrict' && route != 398) return null;

	return tripname;
}

function toTitleCaseEnglish(str: string) {
	const minorWords = [
		'a',
		'an',
		'and',
		'at',
		'but',
		'by',
		'for',
		'in',
		'nor',
		'of',
		'on',
		'or',
		'so',
		'the',
		'to',
		'up',
		'yet'
	];
	const preferredSpellings: Record<string, string> = {
		uc: 'UC',
		uci: 'UCI',
		ucla: 'UCLA',
		ucsd: 'UCSD',
		ii: 'II',
		iii: 'III'
	};

	return str.toLowerCase().replace(/\w+/g, (word, index) => {
		if (preferredSpellings[word]) {
			return preferredSpellings[word];
		}
		// Always capitalize the first word
		if (index === 0 || !minorWords.includes(word)) {
			return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
		} else {
			return word; // Keep minor words lowercase
		}
	});
}

export function fixHeadsignText(name: string | null, chateau: string | null, route: string | null) {
	if (name == null) {
		return '';
	}

	if (chateau == 'orangecountytransportationauthority') {
		return toTitleCaseEnglish(name);
	}

	name = name.replace('Counterclockwise', translate('anticlockwise'));
	name = name.replace('Clockwise', translate('clockwise'));

	if (route != null) {
		if (name.startsWith(route)) {
			name = name.replace(route + ' - ', '').trim();
		}
	}

	const fixPatterns: Record<string, string> = {
		'L.A. Union Station': 'Los Angeles',
		'12th & Imperial': "12th/Imp'l",
		'El Cajon / Arnele': 'El Cajon',
		'Downtown SD': 'Downtown',
		Ucsd: 'UCSD',
		Sdsu: 'SDSU',
		Utc: 'UTC',
		'Va / Ucsd': 'UTC',
		'UTC/VA Med Ctr': 'UTC',
		'Old Town to Airport Shuttle': 'Airport'
	};

	return fixPatterns[name] || fixStationName(name);
}

export function fixStationName(name: string) {
	const fixPatterns: Record<string, string> = {
		'L.A. Union Station': 'Los Angeles',
		'Sabre Springs & Penasquitos Transit Station': 'Sabre Springs/Peñasquitos',
		'Clairemont Mesa Bl & Complex Dr': 'Kearny Mesa',
		'Clairemont Mesa Bl & Overland Av': 'Overland Avenue',
		'Clairemont Mesa Bl & Ruffin Rd': 'Ruffin Road',
		'Broadway & Park Bl': 'City College',
		'Broadway & 4th Av': 'Horton Plaza',
		'Broadway & 5th Av': 'Horton Plaza',
		'India St & C St': 'America Plaza',
		'SR-905 & Caliente Av': 'Caliente Avenue',
		'Seacoast Dr & Evergreen Av': 'Imperial Beach Pier',
		'32nd/Commercial St Station': '32nd & Commercial',
		'25th/Commercial St Station': '25th & Commercial',
		'I-15 Centerline Sta & University Av': 'City Heights',
		'I-15 Centerline Sta & El Cajon Bl': 'Boulevard',
		'San Diego - Santa Fe Depot': 'Santa Fe Depot',
		'San Diego - Old Town': 'Old Town',
		'Burbank Airport - North (Av Line) Metrolink Station': 'Burbank Airport North',
		'Burbank Airport - South (Vc Line) Metrolink Station': 'Burbank Airport South',
		'University Center South': 'University Centre South',
		'University Center North': 'University Centre North'
	};

	return (
		fixPatterns[name] ||
		titleCase(
			name
				.replace(' Transit Station', '')
				.replace(' Transit Sta', '')
				.replace(' Transportation Center', '')
				.replace(' Transit Center', '')
				.replace(' Transit Ctr', '')
				.replace(' Station', '')
				.replace(' Metrolink', '')
				.replace(' Amtrak', '')
				.trim()
		)
	);
}

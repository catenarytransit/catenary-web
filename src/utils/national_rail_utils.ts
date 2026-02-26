export interface AgencyInfo {
	name: string;
	icon: string | null;
}

const AGENCY_MAP: Record<string, AgencyInfo> = {
	GW: { name: 'Great Western Railway', icon: 'GreaterWesternRailway.svg' },
	GWR: { name: 'Great Western Railway', icon: 'GreaterWesternRailway.svg' },
	SW: { name: 'South Western Railway', icon: 'SouthWesternRailway.svg' },
	SN: { name: 'Southern', icon: 'SouthernIcon.svg' },
	CC: { name: 'c2c', icon: 'c2c_logo.svg' },
	LE: { name: 'Greater Anglia', icon: null },
	CH: { name: 'Chiltern Railways', icon: null },
	VT: { name: 'Avanti West Coast', icon: null },
	HT: { name: 'Hull Trains', icon: null },
	GN: { name: 'Great Northern', icon: null },
	TL: { name: 'Thameslink', icon: null },
	LO: { name: 'London Overground', icon: 'uk-london-overground.svg' },
	AW: { name: 'Transport for Wales', icon: null },
	SR: { name: 'ScotRail', icon: null },
	GR: { name: 'London North Eastern Railway', icon: null },
	EM: { name: 'East Midlands Railway', icon: null },
	LM: { name: 'West Midlands Railway', icon: null },
	SE: { name: 'Southeastern', icon: null },
	XC: { name: 'CrossCountry', icon: null },
	XR: { name: 'Elizabeth Line', icon: 'Elizabeth_line_roundel.png' }
};

const NAME_MAP: Record<string, AgencyInfo> = {
	gwr: { name: 'Great Western Railway', icon: 'GreaterWesternRailway.svg' },
	'london overground': { name: 'London Overground', icon: 'uk-london-overground.svg' },
	c2c: { name: 'c2c', icon: 'c2c_logo.svg' },
	'elizabeth line': { name: 'Elizabeth Line', icon: 'Elizabeth_line_roundel.png' }
};

export function getAgencyInfo(
	agencyId?: string | null,
	agencyName?: string | null
): AgencyInfo | null {
	if (agencyId && AGENCY_MAP[agencyId]) {
		return AGENCY_MAP[agencyId];
	}
	if (agencyName && NAME_MAP[agencyName.trim().toLowerCase()]) {
		return NAME_MAP[agencyName.trim().toLowerCase()];
	}
	return null;
}

export function getAgencyIconUrl(
	agencyId?: string | null,
	agencyName?: string | null
): string | null {
	const info = getAgencyInfo(agencyId, agencyName);
	return info?.icon ? `https://maps.catenarymaps.org/agencyicons/${info.icon}` : null;
}

export function cleanStationName(name: string): string {
	return name
		.replace('Station ', '')
		.replace(' Station', '')
		.replace(', Bahnhof', '')
		.replace(' Bahnhof', '')
		.replace('Estación de tren ', '')
		.replace(' Metrolink', '')
		.replace('Northbound', 'N.B.')
		.replace('Eastbound', 'E.B.')
		.replace('Southbound', 'S.B.')
		.replace('Westbound', 'W.B.')
		.replace(' (Railway) ', '')
		.replace(' Light Rail', '')
		.replace(' Amtrak', '');
}

export function cleanPlatformName(platform: string): string {
	return platform.replace('Track', '').replace('platform', '').replace('Platform', '').trim();
}

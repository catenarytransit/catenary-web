// Île-de-France Mobilités (IDFM) chateau ID
export const IDFM_CHATEAU_ID = 'île~de~france~mobilités';

// Map of route short names to icon file names
// Keys are lowercase versions of route short names
const RATP_ICON_MAP: Record<string, string> = {
	// Metro lines
	'1': 'metro_1',
	'2': 'metro_2',
	'3': 'metro_3',
	'3b': 'metro_3bis',
	'3bis': 'metro_3bis',
	'4': 'metro_4',
	'5': 'metro_5',
	'6': 'metro_6',
	'7': 'metro_7',
	'7b': 'metro_7bis',
	'7bis': 'metro_7bis',
	'8': 'metro_8',
	'9': 'metro_9',
	'10': 'metro_10',
	'11': 'metro_11',
	'12': 'metro_12',
	'13': 'metro_13',
	'14': 'metro_14',
	'15': 'metro_15',
	'16': 'metro_16',
	'17': 'metro_17',
	'18': 'metro_18',
	'19': 'metro_19',

	// RER lines
	a: 'rer_a',
	b: 'rer_b',
	c: 'rer_c',
	d: 'rer_d',
	e: 'rer_e',

	// Transilien train lines
	h: 'train_h',
	j: 'train_j',
	k: 'train_k',
	l: 'train_l',
	n: 'train_n',
	p: 'train_p',
	r: 'train_r',
	u: 'train_u',
	v: 'train_v',

	// Tram lines
	t1: 'tram_1',
	t2: 'tram_2',
	t3a: 'tram_3a',
	t3b: 'tram_3b',
	t4: 'tram_4',
	t5: 'tram_5',
	t6: 'tram_6',
	t7: 'tram_7',
	t8: 'tram_8',
	t9: 'tram_9',
	t10: 'tram_10',
	t11: 'tram_11',
	t12: 'tram_12',
	t13: 'tram_13',
	t14: 'tram_14'
};

/**
 * Check if a route has a RATP icon available
 */
export function isRatpRoute(routeShortName: string | null | undefined): boolean {
	if (!routeShortName) return false;
	const normalized = routeShortName.toLowerCase().trim();
	return normalized in RATP_ICON_MAP;
}

/**
 * Get the icon path for a RATP route
 * @returns The path to the SVG icon, or null if not found
 */
export function getRatpIconPath(routeShortName: string | null | undefined): string | null {
	if (!routeShortName) return null;
	const normalized = routeShortName.toLowerCase().trim();
	const iconName = RATP_ICON_MAP[normalized];
	if (!iconName) return null;
	return `/ratp/${iconName}.svg`;
}

/**
 * Check if this is the IDFM chateau
 */
export function isIdfmChateau(chateauId: string): boolean {
	return chateauId === IDFM_CHATEAU_ID;
}

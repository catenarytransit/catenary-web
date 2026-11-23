export interface DepartureRoute {
	short_name?: string | null;
	long_name?: string | null;
	color?: string | null;
	text_color?: string | null;
	route_type?: number | null;
}

export interface DepartureRouteFilter {
	key: string;
	chateau: string;
	name: string;
	routeIds: Set<string>;
	route: DepartureRoute;
}

export type DepartureRouteMode = 'bus' | 'metro' | 'rail' | 'other';

export function departureRouteMode(routeType: number): DepartureRouteMode {
	if (
		[3, 11, 800].includes(routeType) ||
		(routeType >= 200 && routeType <= 209) ||
		(routeType >= 700 && routeType <= 799)
	) return 'bus';
	if ([0, 1, 5, 7, 12, 900].includes(routeType)) return 'metro';
	if ([2, 106, 107, 101, 100, 102, 103].includes(routeType)) return 'rail';
	return 'other';
}

const routeNames = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

// A displayed line can have several GTFS IDs. Keep feeds separate even when badges match.
export function departureRouteFilters(
	routes: Record<string, Record<string, DepartureRoute>>,
	mode: string
): DepartureRouteFilter[] {
	const groups = new Map<string, DepartureRouteFilter>();
	for (const [chateau, definitions] of Object.entries(routes)) {
		for (const [id, route] of Object.entries(definitions)) {
			if (departureRouteMode(route.route_type ?? 3) !== mode) continue;
			const name = route.short_name?.trim() || route.long_name?.trim() || id;
			const color = (route.color ?? '').trim().replace(/^#/, '').toUpperCase();
			const key = JSON.stringify([chateau, name, color]);
			const group = groups.get(key);
			if (group) group.routeIds.add(id);
			else groups.set(key, { key, chateau, name, routeIds: new Set([id]), route });
		}
	}
	return [...groups.values()].sort(
		(a, b) =>
			routeNames.compare(a.name, b.name) ||
			a.name.localeCompare(b.name) ||
			a.key.localeCompare(b.key)
	);
}

export function routeFiltersEnabled(
	filters: DepartureRouteFilter[],
	mode: string,
	hasCategoryFilters: boolean,
	hasNationalRail: boolean
): boolean {
	return filters.length > 1 && !(mode === 'rail' && (hasCategoryFilters || hasNationalRail));
}

export function matchesDepartureRouteFilters(
	chateau: string,
	routeId: string,
	selected: Set<string>,
	filters: DepartureRouteFilter[]
): boolean {
	return (
		selected.size === 0 ||
		filters.some(
			(filter) =>
				selected.has(filter.key) && filter.chateau === chateau && filter.routeIds.has(routeId)
		)
	);
}

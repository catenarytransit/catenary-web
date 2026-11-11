/** Presentation-only stop labels: preserve GTFS stop names and identifiers. */
const stationSuffix = /\s+Station$/i;

export function shouldShortenTrainStationStops(
	routeType: number | null | undefined,
	names: ReadonlyArray<string | null | undefined>
): boolean {
	return routeType !== null && routeType !== undefined &&
		[0, 1, 2].includes(routeType) && names.length > 0 &&
		names.every(name => {
			const trimmed = name?.trim() ?? '';
			return stationSuffix.test(trimmed) && trimmed.replace(stationSuffix, '').length > 0;
		});
}

export function displayTrainStationStopName(name: string, shorten: boolean): string {
	return shorten ? name.trimEnd().replace(stationSuffix, '') : name;
}

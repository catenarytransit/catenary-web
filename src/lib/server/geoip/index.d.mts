export interface GeoipLocation {
	longitude: number;
	latitude: number;
	zoom: number;
}
export function createGeoipLookup(
	directories: string[],
	warn?: (message: string) => void
): (ip: string | null) => Promise<GeoipLocation | null>;
export const lookupIp: (ip: string | null) => Promise<GeoipLocation | null>;
export function visitorIp(headers: Headers): string | null;

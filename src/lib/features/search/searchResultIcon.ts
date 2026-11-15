/** Icons for search results, using the transit mode or Cypress OSM categories. */
const ICONS = {
  train: '/icons/train-right-fill-color.svg',
  metro: '/icons/metro-right-fill-color.svg',
  tram: '/icons/tram-right-fill-color.svg',
  bus: '/icons/bus-right-fill-color.svg',
  hotel: '/icons/sbb/roof-bed-small.svg',
  restaurant: '/icons/sbb/cutlery-small.svg',
  park: '/icons/sbb/tree-small.svg',
  government: '/icons/sbb/parliament-small.svg',
  recent: '/icons/sbb/arrow-circle-time-small.svg'
} as const;

function transportIcon(value: unknown): string | null {
  // GTFS route_type and extended route_type (rail 100–199, bus 700–799).
  if (typeof value === 'number' || (typeof value === 'string' && /^\\d+$/.test(value))) {
    const type = Number(value);
    if (type === 0 || (type >= 900 && type < 1000)) return ICONS.tram;
    if (type === 1 || (type >= 400 && type < 700)) return ICONS.metro;
    if (type === 2 || (type >= 100 && type < 400)) return ICONS.train;
    if (type === 3 || (type >= 700 && type < 900)) return ICONS.bus;
  }
  if (typeof value !== 'string') return null;
  const mode = value.toLowerCase();
  if (/tram|streetcar|light_?rail/.test(mode)) return ICONS.tram;
  if (/metro|subway|underground|rapid_?transit/.test(mode)) return ICONS.metro;
  if (/train|rail|station|funicular/.test(mode)) return ICONS.train;
  if (/bus|coach|trolleybus/.test(mode)) return ICONS.bus;
  return null;
}

export function searchResultIcon(
  item: { type: string; data?: any },
  isRecent = false
): string {
  if (isRecent) return ICONS.recent;
  const data = item.data ?? {};
  if (item.type === 'route') {
    return transportIcon(data.route_type ?? data.routeType ?? data.type) ?? ICONS.bus;
  }
  if (item.type === 'stop' || item.type === 'osm_station') {
    const mode = transportIcon(data.mode_type ?? data.station_type ?? data.route_type ?? data.location_type);
    if (mode) return mode;
    const routeTypes: unknown[] = Array.isArray(data.routes) ? data.routes : [];
    for (const route of routeTypes) {
      const icon = transportIcon(route?.route_type ?? route?.routeType ?? route?.type);
      if (icon) return icon;
    }
    return ICONS.train;
  }
  const properties = item.type === 'cypress' ? data.properties ?? {} : data;
  const categories: string[] = Array.isArray(properties.categories)
    ? properties.categories.filter((category: unknown): category is string => typeof category === 'string')
    : [];
  const terms = [...categories, properties.layer, properties.osm_type, properties.osm_class]
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.toLowerCase());
  const matches = (pattern: RegExp) => terms.some(value => pattern.test(value));
  if (matches(/(^|[:_])(?:railway|train_station|station)(?:$|[:_])|railway:station/)) return ICONS.train;
  if (matches(/metro|subway/)) return ICONS.metro;
  if (matches(/tram|streetcar/)) return ICONS.tram;
  if (matches(/bus_station|bus_stop|highway:bus_stop/)) return ICONS.bus;
  if (matches(/tourism:(?:hotel|motel|hostel|guest_house|apartment|chalet)|accommodation|lodging/)) return ICONS.hotel;
  if (matches(/amenity:(?:restaurant|cafe|fast_food|food_court|pub|bar)|restaurant|eatery/)) return ICONS.restaurant;
  if (matches(/leisure:(?:park|garden|nature_reserve)|landuse:(?:forest|recreation_ground)|natural:(?:wood|forest)|park/)) return ICONS.park;
  if (matches(/amenity:(?:townhall|courthouse|public_building)|office:government|government|townhall/)) return ICONS.government;
  return '/icons/sbb/tree-small.svg';
}

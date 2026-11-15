import { searchResultIcon } from './searchResultIcon';
import type { DirectionsLocation } from './state/directionsSearch';

/** Share the main autocomplete's category and transport icon mapping. */
export function directionsLocationIcon(location: DirectionsLocation, isRecent = false): string {
  const type = location.kind === 'station' ? 'osm_station'
    : location.kind === 'stop' ? 'stop' : 'cypress';
  return searchResultIcon({
    type,
    data: type === 'cypress'
      ? { properties: { categories: location.categories, layer: location.layer } }
      : { mode_type: location.modeType }
  }, isRecent);
}

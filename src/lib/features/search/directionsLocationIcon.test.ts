import { describe, expect, it } from 'vitest';
import { directionsLocationIcon } from './directionsLocationIcon';
import type { DirectionsLocation } from './state/directionsSearch';

const location = (kind: DirectionsLocation['kind'], categories?: string[]): DirectionsLocation => ({
  key: 'test:1', kind, name: 'Test', address: '', lat: 34, lon: -118, categories
});

describe('trip planner search icons', () => {
  it.each([
    ['tourism:hotel', 'roof-bed-small'],
    ['amenity:restaurant', 'cutlery-small'],
    ['leisure:park', 'tree-small'],
    ['amenity:townhall', 'parliament-small'],
    ['shop:supermarket', 'shopping-bag-small']
  ])('maps %s using the shared search icon resolver', (category, expected) => {
    expect(directionsLocationIcon(location('place', [category]))).toContain(expected);
  });

  it('uses the location-pin fallback for unknown categories', () => {
    expect(directionsLocationIcon(location('place', ['amenity:library']))).toContain('location-pin-small');
  });

  it('preserves transit icons', () => {
    expect(directionsLocationIcon(location('station'))).toContain('train-right');
    expect(directionsLocationIcon({ ...location('stop'), modeType: 'bus' })).toContain('bus-right');
    expect(directionsLocationIcon({ ...location('station'), modeType: 'subway' })).toContain('metro-right');
  });

  it('shows a recent-history icon in empty suggestions', () => {
    expect(directionsLocationIcon(location('place', ['shop:supermarket']), true)).toContain('arrow-circle-time-small');
  });
});

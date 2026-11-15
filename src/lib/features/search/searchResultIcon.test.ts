import { describe, expect, it } from 'vitest';
import { searchResultIcon } from './searchResultIcon';

describe('search result icons', () => {
  it('maps Cypress place categories', () => {
    for (const [category, expected] of [
      ['tourism:hotel', 'roof-bed-small'],
      ['amenity:restaurant', 'cutlery-small'],
      ['leisure:park', 'tree-small'],
      ['amenity:townhall', 'parliament-small'],
      ['shop:clothes', 'shopping-bag-small'],
      ['shop:supermarket', 'shopping-bag-small'],
      ['amenity:marketplace', 'shopping-bag-small']
    ]) {
      expect(searchResultIcon({ type: 'cypress', data: { properties: { categories: [category] } } })).toContain(expected);
    }
  });
  it('maps GTFS modes and station types', () => {
    expect(searchResultIcon({ type: 'route', data: { route_type: 0 } })).toContain('tram-right');
    expect(searchResultIcon({ type: 'route', data: { route_type: 1 } })).toContain('metro-right');
    expect(searchResultIcon({ type: 'route', data: { route_type: 2 } })).toContain('train-right');
    expect(searchResultIcon({ type: 'route', data: { route_type: 3 } })).toContain('bus-right');
    expect(searchResultIcon({ type: 'osm_station', data: { mode_type: 'subway' } })).toContain('metro-right');
  });
  it('uses recent icon for empty-query history', () => {
    expect(searchResultIcon({ type: 'stop', data: {} }, true)).toContain('arrow-circle-time-small');
  });
});

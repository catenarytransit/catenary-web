import { writable } from 'svelte/store';
import type { RoutePoint } from './edelweiss';

export const footpathDebugEnabled = writable(false);
export function loadFootpathDebugPreference(): void {
  if (typeof window !== 'undefined') {
    footpathDebugEnabled.set(window.localStorage.getItem('routing-footpath-debug') === 'true');
  }
}
export function setFootpathDebugEnabled(enabled: boolean): void {
  footpathDebugEnabled.set(enabled);
  if (typeof window !== 'undefined') window.localStorage.setItem('routing-footpath-debug', String(enabled));
}
export type DebugStop = RoutePoint & { stopIndex?: number };
export interface DebugEdge {
  target: DebugStop & { stopIndex: number; stopId: string; routeCount: number };
  seconds: number;
  straightLineMeters: number;
}
export interface DebugFootpaths {
  transitRegion: string;
  stop: DebugEdge['target'];
  outgoing: DebugEdge[];
  incoming: DebugEdge[];
  outgoingCount: number;
  incomingCount: number;
  truncated: boolean;
}
export async function inspectFootpaths(stop: DebugStop, signal: AbortSignal): Promise<DebugFootpaths> {
  if (!Number.isInteger(stop.stopIndex) || (stop.stopIndex ?? -1) < 0) throw new Error('This stop has no compiled timetable index.');
  const response = await fetch('https://edelweiss.catenarymaps.org/v1/debug/footpaths', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stopIndex: stop.stopIndex, lat: stop.lat, lon: stop.lon, maxEdges: 256 }),
    signal
  });
  if (!response.ok) {
    if (response.status === 404) throw new Error('Footpath inspection is disabled on this Edelweiss server.');
    throw new Error((await response.text()).slice(0, 240) || `Footpath inspector HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Trim a transit shape to the path actually ridden between the leg's boarding
 * and alighting stops. GTFS shapes may cover the whole trip, not just this leg.
 *
 * Project stops onto the shape segments (rather than selecting the nearest
 * vertices) so partial segments are retained precisely. Prefer the direction
 * of the supplied shape when endpoints occur more than once, as on loop routes.
 */
type LngLat = [number, number];
type Stop = { lat: number; lon: number };

type Projection = {
  index: number;
  fraction: number;
  point: LngLat;
  distanceMeters: number;
};

const METERS_PER_DEGREE = 111_195;
const MAX_STOP_OFFSET_METERS = 350;
const REPEATED_STOP_TOLERANCE_METERS = 30;
const FORWARD_PREFERENCE_METERS = 5;

function validStop(point: Stop | null | undefined): point is Stop {
  return !!point && Number.isFinite(point.lat) && Number.isFinite(point.lon) &&
    Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180;
}

function longitudeDifference(lon: number, origin: number): number {
  let difference = lon - origin;
  if (difference > 180) difference -= 360;
  if (difference < -180) difference += 360;
  return difference;
}

function normalizeLongitude(lon: number): number {
  return ((lon + 180) % 360 + 360) % 360 - 180;
}

function projectionsNearStop(coordinates: ReadonlyArray<LngLat>, stop: Stop): Projection[] {
  const lonScale = METERS_PER_DEGREE * Math.max(0.00001, Math.cos(stop.lat * Math.PI / 180));
  const candidates: Projection[] = [];
  for (let index = 0; index < coordinates.length - 1; index++) {
    const [lonA, latA] = coordinates[index];
    const [lonB, latB] = coordinates[index + 1];
    const ax = longitudeDifference(lonA, stop.lon) * lonScale;
    const ay = (latA - stop.lat) * METERS_PER_DEGREE;
    const bx = longitudeDifference(lonB, stop.lon) * lonScale;
    const by = (latB - stop.lat) * METERS_PER_DEGREE;
    const dx = bx - ax;
    const dy = by - ay;
    const squaredLength = dx * dx + dy * dy;
    if (!Number.isFinite(squaredLength) || squaredLength === 0) continue;

    const fraction = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / squaredLength));
    const x = ax + fraction * dx;
    const y = ay + fraction * dy;
    const distanceMeters = Math.hypot(x, y);
    if (distanceMeters > MAX_STOP_OFFSET_METERS) continue;
    candidates.push({
      index,
      fraction,
      point: [
        normalizeLongitude(stop.lon + x / lonScale),
        stop.lat + y / METERS_PER_DEGREE
      ],
      distanceMeters
    });
  }
  candidates.sort((a, b) => a.distanceMeters - b.distanceMeters);
  if (!candidates.length) return [];
  // Keep alternative passes through a loop or a nearby parallel segment.
  const cutoff = Math.min(MAX_STOP_OFFSET_METERS, candidates[0].distanceMeters + REPEATED_STOP_TOLERANCE_METERS);
  return candidates.filter((candidate) => candidate.distanceMeters <= cutoff).slice(0, 64);
}

function samePoint(a: LngLat, b: LngLat): boolean {
  return Math.abs(longitudeDifference(a[0], b[0])) < 1e-9 &&
    Math.abs(a[1] - b[1]) < 1e-9;
}

function distanceMeters(a: Stop, b: Stop): number {
  const latScale = METERS_PER_DEGREE;
  const lonScale = latScale * Math.cos((a.lat + b.lat) * Math.PI / 360);
  return Math.hypot(
    longitudeDifference(a.lon, b.lon) * lonScale,
    (a.lat - b.lat) * latScale
  );
}

export function trimLegGeometryToStops(
  coordinates: ReadonlyArray<LngLat>,
  from: Stop | null | undefined,
  to: Stop | null | undefined
): LngLat[] {
  const original = () => coordinates.map(([lon, lat]) => [lon, lat] as LngLat);
  if (coordinates.length < 2 || !validStop(from) || !validStop(to)) return original();
  // A loop returning to its origin cannot be disambiguated from endpoints alone.
  if (distanceMeters(from, to) < 20) return original();

  const starts = projectionsNearStop(coordinates, from);
  const ends = projectionsNearStop(coordinates, to);
  if (!starts.length || !ends.length) return original();

  let chosen: { start: Projection; end: Projection } | null = null;
  let bestScore = Infinity;
  for (const start of starts) {
    for (const end of ends) {
      const startPosition = start.index + start.fraction;
      const endPosition = end.index + end.fraction;
      if (Math.abs(startPosition - endPosition) < 1e-8) continue;
      // A small forward preference resolves repeated stations in loops while
      // still allowing a genuinely reversed shape to be traversed backwards.
      const score = start.distanceMeters + end.distanceMeters +
        (startPosition <= endPosition ? 0 : FORWARD_PREFERENCE_METERS);
      if (score < bestScore) {
        bestScore = score;
        chosen = { start, end };
      }
    }
  }
  if (!chosen) return original();

  const { start, end } = chosen;
  const reverse = start.index + start.fraction > end.index + end.fraction;
  const first = reverse ? end : start;
  const last = reverse ? start : end;
  const clipped: LngLat[] = [first.point];
  for (let i = first.index + 1; i <= last.index; i++) {
    clipped.push([coordinates[i][0], coordinates[i][1]]);
  }
  clipped.push(last.point);

  const deduplicated = clipped.filter((point, index) => index === 0 || !samePoint(point, clipped[index - 1]));
  if (deduplicated.length < 2) return original();
  return reverse ? deduplicated.reverse() : deduplicated;
}

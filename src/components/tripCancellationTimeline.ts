/**
 * Distinguish cancelled trip ends (shortening) from skipped stops in the middle (detour).
 * The boundary to a served stop is part of the shortened segment.
 */
export interface TripCancellationTimeline {
  cancelledStops: boolean[];
  truncatedStops: boolean[];
  dashedSegments: boolean[];
  lastBoardableStopIndex: number | null;
}

export function getTripCancellationTimeline(
  stops: ReadonlyArray<{ schedule_relationship?: number | null }>,
  isTripCancelled: boolean
): TripCancellationTimeline {
  const cancelledStops = stops.map((stop) => isTripCancelled || stop.schedule_relationship === 1);
  const firstServed = cancelledStops.indexOf(false);
  const lastServed = cancelledStops.lastIndexOf(false);
  const truncatedStops = cancelledStops.map(
    (cancelled, i) => cancelled && (firstServed === -1 || i < firstServed || i > lastServed)
  );
  const dashedSegments = truncatedStops.slice(0, -1).map(
    (truncated, i) => truncated || truncatedStops[i + 1]
  );
  // Show exit-only at the last operating stop before a cancelled suffix,
  // never for an interior detour or for a completely cancelled trip.
  const lastBoardableStopIndex =
    !isTripCancelled && lastServed >= 0 && lastServed < stops.length - 1
      ? lastServed
      : null;
  return { cancelledStops, truncatedStops, dashedSegments, lastBoardableStopIndex };
}

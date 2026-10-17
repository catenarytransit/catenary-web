import { describe, expect, it } from 'vitest';
import { getTripCancellationTimeline } from './tripCancellationTimeline';

const timeline = (statuses: number[], tripCancelled = false) =>
  getTripCancellationTimeline(
    statuses.map((schedule_relationship) => ({ schedule_relationship })),
    tripCancelled
  );

describe('trip cancellation timeline', () => {
  it('keeps an operating trip solid', () => {
    const t = timeline([0, 0, 0]);
    expect(t.cancelledStops).toEqual([false, false, false]);
    expect(t.dashedSegments).toEqual([false, false]);
    expect(t.lastBoardableStopIndex).toBeNull();
  });

  it('dashes a shortened beginning and its boundary to the first served stop', () => {
    const t = timeline([1, 1, 0, 0]);
    expect(t.cancelledStops).toEqual([true, true, false, false]);
    expect(t.dashedSegments).toEqual([true, true, false]);
    expect(t.lastBoardableStopIndex).toBeNull();
  });

  it('dashes a shortened ending and identifies the final operating stop', () => {
    const t = timeline([0, 0, 1, 1]);
    expect(t.truncatedStops).toEqual([false, false, true, true]);
    expect(t.dashedSegments).toEqual([false, true, true]);
    expect(t.lastBoardableStopIndex).toBe(1);
  });

  it('supports cancellation at both ends', () => {
    const t = timeline([1, 0, 0, 1, 1]);
    expect(t.dashedSegments).toEqual([true, false, true, true]);
    expect(t.lastBoardableStopIndex).toBe(2);
  });

  it('marks interior detour stops red without styling the detour as a shortened trip', () => {
    const t = timeline([0, 1, 1, 0]);
    expect(t.cancelledStops).toEqual([false, true, true, false]);
    expect(t.truncatedStops).toEqual([false, false, false, false]);
    expect(t.dashedSegments).toEqual([false, false, false]);
    expect(t.lastBoardableStopIndex).toBeNull();
  });

  it('keeps completely cancelled trips red and dashed', () => {
    const t = timeline([0, 0, 0], true);
    expect(t.cancelledStops).toEqual([true, true, true]);
    expect(t.dashedSegments).toEqual([true, true]);
    expect(t.lastBoardableStopIndex).toBeNull();
  });

  it('does not invent an exit-only stop for all skipped or empty trips', () => {
    expect(timeline([1, 1, 1]).lastBoardableStopIndex).toBeNull();
    expect(timeline([1, 1, 1]).dashedSegments).toEqual([true, true]);
    expect(timeline([]).lastBoardableStopIndex).toBeNull();
    expect(timeline([]).dashedSegments).toEqual([]);
    expect(timeline([1]).dashedSegments).toEqual([]);
  });

  it('recomputes the shortened suffix when realtime status changes', () => {
    expect(timeline([0, 0, 1]).lastBoardableStopIndex).toBe(1);
    expect(timeline([0, 0, 0]).lastBoardableStopIndex).toBeNull();
  });
});

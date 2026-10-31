<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { map_pointer_store } from '$root/globalstores';
  import { inspectFootpaths, type DebugFootpaths, type DebugStop, footpathDebugEnabled } from '$lib/features/directions/footpathDebug';
  import { drawFootpathLayers, clearFootpathLayers } from '$lib/features/directions/footpathDebugLayers';
  import type { Map } from 'maplibre-gl';

  export let stop: DebugStop;
  export let onClose: () => void;
  let result: DebugFootpaths | null = null;
  let error = '';
  let loading = false;
  let incoming = true;
  let outgoing = true;
  let controller: AbortController | null = null;
  let map: Map | null = null;
  let unsub: (() => void) | null = null;
  let previousKey = '';

  function redraw(): void {
    if (map && result) drawFootpathLayers(map, result, incoming, outgoing);
  }
  function styleChanged(): void { redraw(); }
  function changeMap(next: Map | null): void {
    if (map === next) return;
    if (map) {
      map.off('styledata', styleChanged);
      clearFootpathLayers(map);
    }
    map = next;
    if (map) { map.on('styledata', styleChanged); redraw(); }
  }
  async function load(selected: DebugStop): Promise<void> {
    controller?.abort();
    controller = new AbortController();
    result = null;
    if (map) clearFootpathLayers(map);
    error = '';
    loading = true;
    try {
      const answer = await inspectFootpaths(selected, controller.signal);
      if (controller.signal.aborted) return;
      result = answer;
      redraw();
    } catch (e) {
      if (!controller.signal.aborted) error = e instanceof Error ? e.message : 'Unable to load footpaths';
    } finally {
      if (!controller.signal.aborted) loading = false;
    }
  }
  $: {
    const key = `${stop.stopIndex}:${stop.lat}:${stop.lon}`;
    if (key !== previousKey) { previousKey = key; void load(stop); }
  }
  $: if (result) redraw();
  $: if (!$footpathDebugEnabled) onClose();
  onMount(() => {
    unsub = map_pointer_store.subscribe(changeMap);
    changeMap(get(map_pointer_store));
  });
  onDestroy(() => { controller?.abort(); unsub?.(); changeMap(null); });
</script>

<section aria-label="Footpath diagnostics" class="rounded-xl border-2 border-amber-600 bg-white p-3 text-gray-900 shadow-lg dark:bg-gray-900 dark:text-white">
  <div class="mb-2 flex items-center justify-between gap-2">
    <h3 class="text-sm font-semibold">Footpath debugger · {stop.name}</h3>
    <button type="button" on:click={onClose} aria-label="Close footpath debugger" class="rounded px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-700">Close</button>
  </div>
  <p class="mb-2 text-xs text-gray-600 dark:text-gray-300">Read-only compiled transfer weights. Map connections are straight-line diagrams, not actual walking paths. Seconds are RAPTOR edge costs.</p>
  <div class="mb-2 flex flex-wrap gap-3 text-xs">
    <label><input type="checkbox" bind:checked={incoming} /> Incoming (orange)</label>
    <label><input type="checkbox" bind:checked={outgoing} /> Outgoing (green)</label>
  </div>
  {#if loading}<p role="status">Loading stored footpaths…</p>{/if}
  {#if error}<p role="alert" class="text-sm text-red-600">{error}</p>{/if}
  {#if result}
    <p class="mb-2 text-xs">Region {result.transitRegion} · stop index #{result.stop.stopIndex} · {result.outgoingCount} outgoing / {result.incomingCount} incoming {result.truncated ? '(showing shortest edges only)' : ''}</p>
    <div class="max-h-48 overflow-y-auto text-xs">
      {#each [...(outgoing ? result.outgoing.map(edge => ({ ...edge, direction: '→' })) : []), ...(incoming ? result.incoming.map(edge => ({ ...edge, direction: '←' })) : [])] as edge, index (index)}
        <button type="button" class="flex w-full items-center justify-between gap-2 border-b border-gray-200 py-1 text-left dark:border-gray-700" on:click={() => { map?.flyTo({ center: [edge.target.lon, edge.target.lat], zoom: 16 }); }}>
          <span>{edge.direction} {edge.target.name} (#{edge.target.stopIndex})</span>
          <span class="shrink-0 tabular-nums">{edge.seconds}s · {edge.straightLineMeters}m</span>
        </button>
      {/each}
    </div>
  {/if}
</section>

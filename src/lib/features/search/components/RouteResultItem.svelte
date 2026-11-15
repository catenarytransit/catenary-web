<script lang="ts">
  export let routeInfo: any;
  export let onClick: () => void;
  export let icon: string;
</script>

<button type="button" class="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left hover:bg-gray-200 dark:hover:bg-gray-700" on:click={onClick}>
  <img src={icon} alt="" aria-hidden="true" class="h-5 w-5 shrink-0 object-contain brightness-0 dark:invert" />
  <span class="min-w-0 text-sm text-gray-800 dark:text-gray-200">{routeInfo.long_name || routeInfo.short_name || 'Route'}</span>
</button>

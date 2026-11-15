<script lang="ts">
  /** Colored transport SVGs remain images; monochrome SBB SVGs are CSS masks. */
  export let icon: string;
  export let sizeClass = 'h-5 w-5';
  $: monochrome = icon.startsWith('/icons/sbb/');
</script>

{#if monochrome}
  <span
    class="{sizeClass} inline-block shrink-0 bg-gray-700 dark:bg-gray-200"
    style="mask: url('{icon}') center / contain no-repeat; -webkit-mask: url('{icon}') center / contain no-repeat;"
    aria-hidden="true"
  ></span>
{:else}
  <img src={icon} alt="" aria-hidden="true" class="{sizeClass} shrink-0 object-contain" />
{/if}

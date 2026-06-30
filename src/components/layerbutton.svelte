<script lang="ts">
	export let layersettings: any;
	export let name: string;
	export let selectedSettingsTab: string;
	export let runSettingsAdapt: any;
	export let urlicon: string;
	export let change: string;
	export let nestedchange: string = '';

	function toggle() {
		if (nestedchange != '') {
			Object.keys(layersettings[selectedSettingsTab][change]).forEach((element) => {
				layersettings[selectedSettingsTab][change][element] = false;
			});
			layersettings[selectedSettingsTab][change][nestedchange] = true;
		} else {
			const newValue = !layersettings[selectedSettingsTab][change];
			layersettings[selectedSettingsTab][change] = newValue;

			if (change === 'shapes') {
				if (layersettings[selectedSettingsTab].showRoutesLabels === undefined) {
					layersettings[selectedSettingsTab].showRoutesLabels = true;
				}
				layersettings[selectedSettingsTab].labelshapes = newValue ? layersettings[selectedSettingsTab].showRoutesLabels : false;
			} else if (change === 'stops') {
				if (layersettings[selectedSettingsTab].showStopNames === undefined) {
					layersettings[selectedSettingsTab].showStopNames = true;
				}
				layersettings[selectedSettingsTab].stoplabels = newValue ? layersettings[selectedSettingsTab].showStopNames : false;
			}
		}
		runSettingsAdapt();
	}
</script>

<!-- {#if layersettings} -->
<!-- {#if layersettings[selectedSettingsTab]} -->
<div
	role="button"
	tabindex="0"
	on:click={toggle}
	on:keydown={toggle}
>
	{#if nestedchange}
		<!--Toggle Routes-->
		<div
			aria-label={`${name} button`}
			class:border-blue-500={layersettings[selectedSettingsTab][change][nestedchange] == true}
			class:dark:border-blue-50={layersettings[selectedSettingsTab][change][nestedchange] == true}
			class:border-transparent={layersettings[selectedSettingsTab][change][nestedchange] == false}
			class={`bg-gray-100 dark:bg-gray-800 rounded-xl border-2`}
		>
			<img src={urlicon} class="w-12 h-12" alt="" />
		</div>
		<p class="text-xs text-center">{name}</p>
	{:else}
		<div
			aria-label={`${name} button`}
			class:border-blue-500={layersettings[selectedSettingsTab][change] == true}
			class:dark:border-blue-50={layersettings[selectedSettingsTab][change] == true}
			class:border-transparent={layersettings[selectedSettingsTab][change] == false}
			class={`bg-gray-100 dark:bg-gray-800 rounded-xl border-2`}
		>
			<img src={urlicon} class="w-12 h-12" alt="" />
		</div>
		<p class="text-xs text-center">{name}</p>
	{/if}
</div>
<!-- {/if}{/if} -->

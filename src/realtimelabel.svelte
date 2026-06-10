<script lang="ts">
	export let layersettings: any;
	export let name: string;
	export let selectedSettingsTab: string;
	export let runSettingsAdapt: any;
	export let symbol: string;
	export let change: string;

	function toggle() {
		layersettings[selectedSettingsTab].label[change] =
			!layersettings[selectedSettingsTab].label[change];
		runSettingsAdapt();
		console.log(layersettings[selectedSettingsTab].label[change]);
	}
</script>

{#if layersettings}
	{#if layersettings[selectedSettingsTab]}
		<div
			role="button"
			tabindex="0"
			on:click={toggle}
			on:keydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					toggle();
				}
			}}
		>
			<!--Toggle Routes-->
			<div
				class:border-blue-500={layersettings[selectedSettingsTab].label[change] == true}
				class:dark:border-blue-50={layersettings[selectedSettingsTab].label[change] == true}
				class:border-transparent={layersettings[selectedSettingsTab].label[change] == false}
				class={`select-none bg-gray-100 dark:bg-gray-800 rounded-xl border-2 w-11 h-11 flex items-center align-center`}
			>
				<div class="mx-auto">
					<span class="material-symbols-outlined content-center text-xl md:text-2xl">
						{symbol}
					</span>
				</div>
			</div>
			<div class=" align-center items-center">
				<p class="text-xs text-center">{name}</p>
			</div>
		</div>
	{/if}{/if}

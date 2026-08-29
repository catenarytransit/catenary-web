<script lang="ts">
	import ConsentBanner from '$components/ConsentBanner.svelte';
	import AndroidDownloadPopup from '$components/AndroidDownloadPopup.svelte';
	import IosDownloadPopup from '$components/IosDownloadPopup.svelte';
	import { showAndroidDownloadPopup } from './state/overlays';
</script>

{#if $showAndroidDownloadPopup}
	<AndroidDownloadPopup />
{/if}

<IosDownloadPopup />
<ConsentBanner />

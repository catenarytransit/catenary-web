<script lang="ts">
	export let text: string;
	export let chateau: string;

	$: isSbbIcOrIr = chateau === 'schweiz' && (text.startsWith('IR') || text.startsWith('IC'));
	$: sbbLogoSrc = isSbbIcOrIr
		? text.startsWith('IR')
			? '/icons/sbb/SBB_IR_Logo.svg'
			: '/icons/sbb/SBB_IC_Logo.svg'
		: '';
	$: remainingText = isSbbIcOrIr ? text.slice(2).trim() : '';

	$: isEc = text === 'EC';
</script>

{#if isEc}
	<span
		class="sbb-logo"
		style={`
			-webkit-mask-image: url(/icons/sbb/SBB_EC_Logo.svg);
			mask-image: url(/icons/sbb/SBB_EC_Logo.svg);
			width: 2.5em;
		`}
	></span>
{:else if isSbbIcOrIr}
	<span class="sbb-logo-wrapper">
		<span
			class="sbb-logo"
			style={`
				-webkit-mask-image: url(${sbbLogoSrc});
				mask-image: url(${sbbLogoSrc});
				width: 2.25em;
			`}
		></span>
		{#if remainingText}
			<span class="sbb-number">{remainingText}</span>
		{/if}
	</span>
{:else}
	{text}
{/if}

<style>
	.sbb-logo-wrapper {
		display: inline-flex;
		align-items: center;
		vertical-align: middle;
	}

	.sbb-logo {
		height: 0.9em;
		display: inline-block;
		vertical-align: middle;
		background-color: currentColor;
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: contain;
		mask-size: contain;
		-webkit-mask-position: center;
		mask-position: center;
	}

	.sbb-number {
		margin-left: 0.2em;
		font-size: 1em;
		font-weight: bold;
		line-height: 1;
	}
</style>

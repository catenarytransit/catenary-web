<script lang="ts">
	/**
	 * A tidbit is a small card that displays information about Catenary. It is displayed in the sidebar.
	 * @property {string} title - The title of the tidbit.
	 * @property {string} description - The description of the tidbit.
	 * @property {string} link - The link to the tidbit.
	 * @property {string} [image] - The image to display with the tidbit.
	 * @property {string} [svg] - The SVG to display with the tidbit.
	 * @property {boolean} [underline] - Whether to underline the first word of the title.
	 * @property {string} [underlineColor] - The color to underline the first word of the title.
	 * @property {string} [ctaText] - The CTA link text (defaults to "Learn more").
	 *
	 * @example
	 * {
	 * 			title: "Blank",
	 * 			description: "This is a blank tidbit. It should never be displayed.",
	 * 			link: "example.com/blank",
	 *
	 * 			image: "url",
	 * 			// OR
	 * 			svg: "<svg />",
	 *
	 * 			// optional, to underline the first word of the title
	 * 			underline: true,
	 * 			// optional, the color of the underline
	 * 			underlineColor: "green-500",
	 * 			// optional, custom CTA text
	 * 			ctaText: "Download"
	 * }
	 *
	 */
	type Tidbit = {
		title: string;
		description: string;
		link: string;
		image?: string;
		svg?: string;
		underline?: boolean;
		underlineColor?: string;
		ctaText?: string;
	};

	/**
	 * An array of tidbits to display in the sidebar.
	 *
	 *
	 *
	 * @type {Tidbit[]}
	 *
	 * */
	let tidbits: Tidbit[] = [
		//{
		//	title: 'Research that pushes mobility forwards.',
		//	description:
		//		'The Catenary team researches advanced routing, ETA, distributed systems, and data processing algorithms to enhance transit experiences for everyone.',
		//	link: 'https://catenarymaps.org/research',
		//	image: 'https://catenarymaps.org/logo-research.svg',
		//	underline: true,
		//	underlineColor: 'green-500'
		//},
		{
			title: 'Consider helping out.',
			description:
				"Catenary is a free and open-source project, but our servers aren't. If you use Catenary on your commute, please consider donating to help keep transit data accessible and open to all!\n\nCatenary is a 501(c)(3) nonprofit organization, so your donations are tax-deductible in the United States.",
			ctaText: 'Donate',
			link: 'https://opencollective.com/catenarymaps/',
			svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-hand-heart"><path d="M11 14h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16"/><path d="m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/><path d="m2 15 6 6"/><path d="M19.5 8.5c.7-.7 1.5-1.6 1.5-2.7A2.73 2.73 0 0 0 16 4a2.78 2.78 0 0 0-5 1.8c0 1.2.8 2 1.5 2.8L16 12Z"/></svg>`
		},
		{
			title: 'Committed to open-source.',
			description:
				"Catenary projects are entirely open-source, mostly under the strong copyleft AGPL-3.0 license. Take a look at the projects we've been working on recently!",
			link: 'https://github.com/catenarytransit',
			svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-cpu"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>`
		},
		{
			title: 'Built by people who care.',
			description:
				'Catenary is supported by passionate developers and riders, with an active Discord and a team that keeps conversations and support moving around the clock.',
			ctaText: 'Join us',
			link: 'https://discord.gg/yVV6dguwtq',
			svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-heart-handshake"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.79 0l2.96 2.66"/><path d="m18 15-2-2"/><path d="m15 18-2-2"/></svg>`
		},

		//{
		//	title: 'ya like swag?',
		//	svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-tshirt"><path d="M4 6h16v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z"/><path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2"/><path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6"/><path d="M10 9h4"/><path d="M9 3v2"/><path d="M15 3v2"/></svg>`,
		//	description:
		//		'Show your support for Catenary with our exclusive merchandise. T-shirts, stickers, and more available now!',
		//	link: 'https://www.redbubble.com/people/catenarymaps/explore'
		//},

		//{
		//	title: "Stay in the loop.",
		//	description: "Join our newsletter to stay up-to-date on the latest Catenary news, updates, and releases.",
		//	link: "https://catenarymaps.org/newsletter",
		//	svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mail"><path d="M22 12h-6l-6 6v-6"/><path d="M2 12l6-6h6l6 6v6"/><path d="M2 12l10 10M22 12L12 2"/></svg>`,
		//},

		// add a More Catenary. More places.
		//The new Catenary Android app is now available, with iOS coming soon. Explore Catenary on the go, with native performance and features.
		{
			title: 'Explore Catenary on mobile.',
			description:
				'The new Catenary Android app is now available, with iOS coming soon. Explore Catenary on the go, with native performance and features.',
			link: 'https://play.google.com/store/apps/details?id=com.catenarymaps.catenary',
			svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-smartphone"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>`,
			ctaText: 'Download'
		},

		// explore catenary on your desktop. (raycast link)
		{
			title: 'Explore Catenary on your desktop.',
			description:
				'Access Catenary directly from your desktop with our Raycast extension. Get quick transit info without opening your browser.',
			link: 'https://www.raycast.com/quacksire/catenary-raycast',
			svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-desktop"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 20h8"/><path d="M12 16v4"/></svg>`,
			ctaText: 'Install Raycast extension'
		}

	];

	// we want to randomly select a tidbit to display
	let tidbitIndex = Math.floor(Math.random() * tidbits.length);

	let dismissed = false;
</script>

{#if !dismissed}
	<div
		class="mx-2 mb-2 rounded-lg border border-gray-700 dark:border-gray-600 hover:border-seashore dark:hover:border-seashore transition-colors relative"
	>
		<!-- Header with icon and title -->
		<div class="p-2.5 flex items-center gap-2 justify-between">
			<div class="flex items-center gap-2 flex-1 min-w-0">
				{#if tidbits[tidbitIndex].image}
					<img src={tidbits[tidbitIndex].image} class="w-5 h-5 flex-shrink-0" alt="" />
				{:else if tidbits[tidbitIndex].svg}
					<div class="w-5 h-5 flex-shrink-0 text-seashore">
						{@html tidbits[tidbitIndex].svg}
					</div>
				{/if}
				{#if tidbits[tidbitIndex].underline}
					<h3 class="font-bold text-sm text-white leading-tight">
						<span class="border-b border-{tidbits[tidbitIndex].underlineColor}"
							>{tidbits[tidbitIndex].title.split(' ')[0]}</span
						>
						{tidbits[tidbitIndex].title.split(' ').slice(1).join(' ')}
					</h3>
				{:else}
					<h3 class="font-bold text-sm text-white leading-tight">{tidbits[tidbitIndex].title}</h3>
				{/if}
			</div>

			<!-- Close button -->
			<button
				on:click={() => (dismissed = true)}
				class="text-gray-400 hover:text-seashore transition-colors p-0.5 flex-shrink-0"
				aria-label="Dismiss"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="w-3.5 h-3.5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
		</div>

		<!-- Content -->
		<div class="border-t border-gray-700 px-2.5 py-3">
			<!-- Description -->
			<p class="text-xs text-gray-300 mb-2 leading-snug">{tidbits[tidbitIndex].description}</p>

			<!-- CTA Link -->
			<a
				target="_blank"
				rel="noopener noreferrer"
				href={tidbits[tidbitIndex].link}
				class={"inline-flex items-center gap-1 text-seashore hover:underline text-sm font-extrabold transition-colors cursor-pointer contrast-[50]"}
			>
				<span>{tidbits[tidbitIndex].ctaText || 'Learn more'}</span>
				<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</a>
		</div>
	</div>
{/if}

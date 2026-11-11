/**
 * On mobile, move a sidebar-owned overlay to the document body.
 *
 * The sidebar uses a CSS transform for its drawer, which makes fixed-position
 * descendants relative to the drawer rather than to the viewport. Reparenting
 * only the top bar keeps its Svelte component/state intact while letting it
 * stay visible over the map as the mobile drawer is dragged.
 */
export function portalToMobileViewport(node: HTMLElement) {
	const placeholder = document.createComment('mobile viewport portal');
	const parent = node.parentNode;
	if (!parent) return;

	parent.insertBefore(placeholder, node);
	const mobile = window.matchMedia('(max-width: 767px)');

	function updatePlacement(): void {
		if (mobile.matches) {
			if (node.parentNode !== document.body) document.body.appendChild(node);
		} else if (placeholder.parentNode) {
			placeholder.parentNode.insertBefore(node, placeholder.nextSibling);
		}
	}

	mobile.addEventListener('change', updatePlacement);
	updatePlacement();

	return {
		destroy() {
			mobile.removeEventListener('change', updatePlacement);
			if (node.parentNode === document.body) node.remove();
			placeholder.remove();
		}
	};
}

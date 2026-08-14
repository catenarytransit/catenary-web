# Frontend architecture

The application is organized as a composition root plus feature-owned modules.

## Composition root

`src/routes/+page.svelte` only selects the application shell. `src/lib/app/AppShell.svelte`
composes the map, search, sidebar, settings, and global overlays. Route files must not create
MapLibre instances, start network clients, register browser listeners, or read persistent storage.

## Application bootstrap

`src/lib/app/bootstrap.ts` owns process-wide initialization and browser-runtime integration:
localization, store initialization, theme synchronization, analytics consent, service-worker
registration, URL bootstrap state, and geolocation startup. Every browser subscription or listener
created there must return a teardown function.

## Features

Each directory under `src/lib/features` owns one user-facing capability:

- `map`: MapLibre lifecycle, map appearance, source registration, layer construction, controls, and realtime map setup. Imperative source and layer definitions live in `sources/` and `layers/`; controllers orchestrate them.
- `sidebar`: responsive sidebar state, dragging, animation, map padding, and screen composition.
- `search`: search UI, request/cache state, result selection, and station history.
- `settings`: layer-settings presentation and its bridge to the map controller.

A feature exposes its supported cross-feature API through `public.ts`. Code outside a feature must
import that public API rather than a feature's internal controller, state, or component paths.
Inside a feature, use short relative imports.

## Shared code

`src/lib/shared` is for small, feature-neutral utilities, including browser storage and theme state. Shared modules must not import feature
modules or start work during module evaluation.

## Legacy migration boundary

`$components` and `$root` are explicit aliases for existing code that has not yet been migrated.
New feature code may use them only at the boundary to legacy modules. Do not add new application
logic to `src/components`; move the owning capability under `src/lib/features` instead.

## Lifecycle rules

- Browser APIs belong in `onMount` or controller `start()` methods.
- Every interval, timeout, store subscription, media-query listener, and window listener must be
  removed by the matching teardown path.
- Controllers own imperative systems such as MapLibre and gesture animation.
- Svelte components render state and forward user intent; they do not own networking or map setup.
- Stores contain state, not hidden browser side effects.

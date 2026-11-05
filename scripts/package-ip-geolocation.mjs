import { cp } from 'node:fs/promises';

// adapter-node's deployment directory is self-contained; no public/static copy.
await cp('.geoip', 'build/geoip', { recursive: true });

/**
 * Backend endpoint configuration.
 *
 * All server URLs live here so deploying against a non-localhost backend is a
 * single env change (VITE_SERVER_HTTP_URL / VITE_SERVER_WS_URL) instead of a
 * hunt through hooks.
 */
const HTTP_BASE: string =
    (import.meta.env.VITE_SERVER_HTTP_URL as string | undefined) ?? 'http://localhost:3000';
const WS_BASE: string =
    (import.meta.env.VITE_SERVER_WS_URL as string | undefined) ?? 'ws://localhost:3000';

/** WebSocket endpoint for streaming mic audio to the Rust sensor engine. */
export const SENSOR_WS_URL = `${WS_BASE}/ws`;

/** REST endpoint that compiles user inputs into a staged simulation. */
export const COMPILE_URL = `${HTTP_BASE}/api/compile`;

/** REST endpoint for post-match conversation analysis. */
export const ANALYZE_URL = `${HTTP_BASE}/api/analyze`;

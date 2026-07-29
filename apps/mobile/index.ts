/**
 * Follow the Money — mobile app entry point.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS APP DOES NOT DO. Please keep this list true.
 *
 *   · NO NETWORK CALLS. Every byte of data it displays is bundled into the app
 *     at build time from apps/mobile/assets/data/*.json. There is no fetch, no
 *     XHR, no WebSocket, no API client, and no runtime data refresh. The app
 *     works with the device in airplane mode, permanently.
 *   · NO ANALYTICS AND NO TELEMETRY. No crash reporter, no event tracking, no
 *     session recording, no device or advertising identifier is read or sent.
 *   · NO ACCOUNTS. No sign-in, no user record, no profile, no sync.
 *   · NO PAYMENT CODE. No in-app purchases, no subscriptions, no ads.
 *   · NO PERSISTED USER STATE beyond what React holds in memory for the current
 *     session. Nothing the reader searches for is written anywhere.
 *
 * The only outbound action possible is one the reader explicitly taps: an
 * external link to a primary government record (congress.gov, fec.gov,
 * usaspending.gov), which opens in the system browser, outside this app.
 *
 * ---------------------------------------------------------------------------
 * FRAMING. Every disclaimer string shown anywhere in this app is imported from
 * @ftm/core (packages/core/src/disclaimer.ts). This app does not write its own
 * wording, and must never start to — see src/components/Framing.tsx.
 * ---------------------------------------------------------------------------
 */

import 'expo-router/entry';

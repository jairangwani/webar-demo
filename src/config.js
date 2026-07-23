// config.js — one place for tunables and the cloud log endpoint.

export const CONFIG = {
  // Cloud log sink. The client POSTs session logs here (fire-and-forget).
  // This is a webhook.site collector I (Claude) can read back via API to see
  // exactly what happened in a test. Empty string = cloud logging off
  // (local in-app logging still works). Swap for a permanent backend later.
  LOG_ENDPOINT: 'https://webhook.site/c299b7e3-e551-4cde-acdb-454476fc040d',

  // Scene tunables
  FLOOR_Y: -1.5,      // virtual floor height below eye level (metres)
  FOCAL_DISTANCE: 3,  // how far ahead the tile/box/label are placed (metres)
};

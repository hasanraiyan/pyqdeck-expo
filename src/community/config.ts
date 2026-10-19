// The Community API is a separate server from the main PYQDeck API (src/api/backend.ts): its own origin, its own
// failure handling. Nothing here shares origin-health or failover state with the main client.

/** This app's community. Each PYQDeck app (BEU, GATE, JEE, NEET) has its own and they never see each other. */
export const COMMUNITY_SLUG = 'beu';

/**
 * Production origin of the Community service. Override with EXPO_PUBLIC_COMMUNITY_API_URL in .env.local to point a
 * dev build at a local server, e.g. http://10.0.2.2:5000 from the Android emulator.
 */
export const COMMUNITY_API_URL =
  process.env.EXPO_PUBLIC_COMMUNITY_API_URL || 'https://community-api.pyqdeck.in';

/**
 * The Activity inbox (the bell tab, its unread badge and the header shortcut). Off until community notifications
 * are complete (push delivery, grouping, settings). Everything behind it is kept; turn this on to bring it all back.
 */
export const COMMUNITY_NOTIFICATIONS_ENABLED = false;

/** Most images per post the composer allows. The server's own limit can only be equal or higher. */
export const COMMUNITY_MAX_IMAGES = 5;

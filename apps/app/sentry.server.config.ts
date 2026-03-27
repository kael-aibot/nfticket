import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  
  // Adjust sampling rate
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
  
  // Environment
  environment: process.env.NODE_ENV || "development",
  release: process.env.APP_VERSION || "dev",
  
  // Server-side integrations
  integrations: [
    Sentry.httpIntegration(),
  ],
  
  // Before send - sanitize
  beforeSend(event) {
    // Filter sensitive headers
    if (event.request?.headers) {
      delete event.request.headers["cookie"];
      delete event.request.headers["authorization"];
      delete event.request.headers["x-api-key"];
    }
    return event;
  },
});

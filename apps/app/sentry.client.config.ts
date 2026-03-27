// app/sentry.client.config.js
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "",
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.1,
  
  // Set sampling rate for profiling
  profilesSampleRate: 0.1,
  
  // Replay Configuration
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  
  // Environment
  environment: process.env.NODE_ENV || "development",
  
  // Release tracking
  release: process.env.NEXT_PUBLIC_APP_VERSION || "dev",
  
  // Before sending, filter out sensitive data
  beforeSend(event) {
    // Remove potentially sensitive query params
    if (event.request?.url) {
      const url = new URL(event.request.url);
      url.searchParams.delete("token");
      url.searchParams.delete("secret");
      url.searchParams.delete("password");
      url.searchParams.delete("key");
      event.request.url = url.toString();
    }
    return event;
  },
});

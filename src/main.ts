import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { initDevHelpers } from './app/dev-helpers';
import { environment } from './environments/environment';
import { initializeSentry } from './app/core/services/sentry.config';

// Initialize Sentry error tracking (production only)
if (environment.production && environment.sentryEnabled) {
  initializeSentry();
}

bootstrapApplication(App, appConfig).catch((err) => console.error(err));

// Initialize dev helpers in development mode
if (!environment.production) {
  initDevHelpers();
}

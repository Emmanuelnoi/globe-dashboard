import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { initDevHelpers } from './app/dev-helpers';
import { environment } from './environments/environment';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));

// Initialize dev helpers in development mode
if (!environment.production) {
  initDevHelpers();
}

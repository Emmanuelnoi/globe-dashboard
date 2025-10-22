import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  ErrorHandler,
  isDevMode,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { GlobalErrorHandlerService } from './core/services/global-error-handler.service';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';

// Icons are now handled directly in the icon component

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([httpErrorInterceptor])),
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandlerService,
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};

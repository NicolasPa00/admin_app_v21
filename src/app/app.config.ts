import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { authInterceptor } from './auth/interceptors/auth.interceptor';
import { ConciliacionPagosService } from './admin/data-access/conciliacion-pagos.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // `anchorScrolling` hace que /privacidad#transferencia salte a esa cláusula, tanto al
    // pulsar en el índice como al abrir el enlace directo. Sin esto, un fragmento en la URL no
    // mueve la página. Y de paso `scrollPositionRestoration` evita quedarse a media página al
    // volver atrás.
    provideRouter(
      routes,
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      }),
    ),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor]),
    ),
    provideClientHydration(withEventReplay()),
    // Se instancia al arrancar: escucha la sesión y el regreso a la pestaña (ver el servicio).
    provideAppInitializer(() => {
      inject(ConciliacionPagosService);
    }),
  ],
};

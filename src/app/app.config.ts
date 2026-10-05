import { ApplicationConfig, DEFAULT_CURRENCY_CODE, LOCALE_ID } from '@angular/core';
import { RouteReuseStrategy, provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { PRIMENG_Z_INDEX } from './primeng-z-index';
import { definePreset } from '@primeuix/themes';
import Material from '@primeuix/themes/material';
import Aura from '@primeuix/themes/aura';

import { routes } from './app.routes';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { AuthInterceptor } from './infrastructure/interceptors/auth-interceptor';
import { TabReuseStrategy } from './infrastructure/routing/tab-reuse.strategy';
import { provideServiceWorker } from '@angular/service-worker';
import { environment } from '../environments/environment';

const MaterialEmerald = definePreset(Material, {
  semantic: {
    primary: {
      50: '#e8f5e9', // Verde claro
      100: '#c8e6c9',
      200: '#a5d6a7',
      300: '#81c784',
      400: '#66bb6a',
      500: '#4caf50', // Cor primária (verde esmeralda)
      600: '#43a047',
      700: '#388e3c',
      800: '#2e7d32',
      900: '#1b5e20',
      950: '#0a3d0c',
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    // Português do Brasil em todo pipe (2026-10-05). O `main.ts` registrava os
    // dados do pt, mas ninguém dizia para usá-los: `currency:'BRL'` saía
    // "R$2,047.70", com milhar e decimal americanos, no app inteiro.
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'BRL' },
    // Estas opções viviam no AppRoutingModule (que estava morto no fim do
    // app.routes.ts) — ou seja, nunca chegaram a valer. Agora valem.
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' })
    ),
    provideAnimationsAsync(),
    providePrimeNG({
      ripple: true,
      zIndex: PRIMENG_Z_INDEX,
      theme: {
          preset: Material,
          options: {
              prefix: 'p',
              // Precisa do ponto: sem ele o PrimeNG gera CSS para um elemento
              // <dark-mode>, que não existe, e o tema escuro nunca era aplicado.
              darkModeSelector: '.dark-mode',
              cssLayer: false
          }
      }
    }),
    provideHttpClient(withInterceptorsFromDi()),
    // Mantém viva a tela de cada aba aberta (ver TabsService).
    { provide: RouteReuseStrategy, useClass: TabReuseStrategy },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: environment.production,
      registrationStrategy: 'registerWhenStable:30000'
    }),
  ]
};

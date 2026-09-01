import { inject } from '@angular/core';
import { map } from 'rxjs';
import { CanActivateFn, Router } from '@angular/router';

import { ClientAuthService } from '../services/client/client-auth.service';
import { SessionRefreshService } from '../services/session-refresh.service';

/**
 * Protege `/cliente/**`.
 *
 * Não reaproveita o `AuthGuard` porque a sessão é outra: o funcionário logado
 * no ERP não deve entrar no portal do cliente por ter um token no navegador, e
 * o inverso também vale.
 */
export const clientGuard: CanActivateFn = () => {
  const auth = inject(ClientAuthService);
  const router = inject(Router);
  const sessionRefresh = inject(SessionRefreshService);

  if (auth.isLoggedIn()) return true;

  // Token vencido não é sessão perdida. O `isLoggedIn` só lê a data do JWT, e
  // navegar não dispara requisição — sem isto, o portal mandava para o login
  // assim que as duas horas passavam, mesmo com a renovação disponível.
  return sessionRefresh.tentarRenovar('cliente').pipe(
    map(renovou => renovou ? true : router.createUrlTree(['/cliente/login'])),
  );
};

/** Impede a tela de login de aparecer para quem já entrou. */
export const clientLoggedOutGuard: CanActivateFn = () => {
  const auth = inject(ClientAuthService);
  const router = inject(Router);

  return auth.isLoggedIn() ? router.createUrlTree(['/cliente']) : true;
};

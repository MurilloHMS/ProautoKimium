import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { ClientAuthService } from '../services/client/client-auth.service';

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

  return auth.isLoggedIn() ? true : router.createUrlTree(['/cliente/login']);
};

/** Impede a tela de login de aparecer para quem já entrou. */
export const clientLoggedOutGuard: CanActivateFn = () => {
  const auth = inject(ClientAuthService);
  const router = inject(Router);

  return auth.isLoggedIn() ? router.createUrlTree(['/cliente']) : true;
};

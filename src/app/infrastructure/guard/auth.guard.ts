import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { Observable, map } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { PermissionStore } from '../state/permission.store';

/** Papel do portal do cliente. Nunca entra na área interna. */
const CLIENT_ROLE = 'CLIENTE';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {

  private readonly permissions = inject(PermissionStore);

  constructor(private auth: AuthService, private router: Router) {}

  /**
   * Devolve `Observable` e não `boolean` **por causa de uma corrida**.
   *
   * As permissões chegam por HTTP depois do login. O guard roda no primeiro
   * clique — se decidisse na hora, decidiria com o mapa vazio e barraria todo
   * mundo, uma vez, de forma intermitente. Esperar o `ensureLoaded` faz a
   * decisão acontecer com o dado na mão.
   */
  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> | boolean {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login']);
      return false;
    }

    // Cliente não entra na área interna em hipótese nenhuma — e a checagem vem
    // ANTES de qualquer permissão porque ele não participa deste sistema: o
    // portal tem sessão e escopo próprios, e ele não tem linha em
    // `user_permissions`. Sem isto, um cliente logado aqui cairia no mapa
    // vazio e veria a tela de acesso negado em vez de voltar para o portal.
    if (this.auth.getUserRoles().includes(CLIENT_ROLE)) {
      this.auth.logout();
      this.router.navigate(['/cliente']);
      return false;
    }

    const screen = route.data?.['screen'] as string | undefined;

    // O `ensureLoaded` vem ANTES da checagem de `screen`, e isso não é estilo.
    //
    // Depois do login a primeira rota é `/home`, que não declara tela. Com o
    // `if (!screen) return true` na frente, o guard devolvia `true` e nunca
    // carregava as permissões — o menu ficava vazio para sempre, inclusive
    // para o admin. Aconteceu de verdade em 2026-08-26.
    return this.permissions.ensureLoaded().pipe(
      map(() => {
        // Rota sem tela não participa do controle: acesso negado, notificações,
        // o próprio início. Trancá-las deixaria a pessoa sem nem o aviso.
        if (!screen) return true;

        if (this.permissions.canOpen(screen)) return true;

        this.router.navigate(['/unauthorized']);
        return false;
      }),
    );
  }
}

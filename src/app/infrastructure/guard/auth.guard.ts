import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { Observable, map, of, switchMap } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { PermissionStore } from '../state/permission.store';
import { SessionRefreshService } from '../services/session-refresh.service';

/** Papel do portal do cliente. Nunca entra na área interna. */
const CLIENT_ROLE = 'CLIENTE';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {

  private readonly permissions = inject(PermissionStore);
  private readonly sessionRefresh = inject(SessionRefreshService);

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
    // **Token vencido não é sessão perdida — é sessão para renovar.**
    //
    // O `isLoggedIn` só lê a data do JWT, sem falar com ninguém. Antes disto, o
    // guard mandava para o login assim que as duas horas passavam: quem clicava
    // num item de menu caía na tela de senha, e o interceptor nunca via nada,
    // porque navegação não é requisição.
    //
    // Renovar aqui é o que faz a renovação valer para o caminho MAIS comum de
    // todos num ERP, que é navegar.
    if (!this.auth.isLoggedIn()) {
      return this.sessionRefresh.tentarRenovar('erp').pipe(
        switchMap(renovou => {
          if (!renovou) {
            this.router.navigate(['/login']);
            return of(false);
          }
          return this.decidir(route);
        }),
      );
    }

    return this.decidir(route);
  }

  /**
   * A decisão em si, depois de a sessão estar garantida.
   *
   * Separado porque agora há dois caminhos até aqui — quem já estava logado e
   * quem acabou de renovar — e os dois precisam passar exatamente pelas mesmas
   * checagens. Duplicar seria a forma óbvia de a renovação virar um desvio das
   * regras de acesso.
   */
  private decidir(route: ActivatedRouteSnapshot): Observable<boolean> {

    // Cliente não entra na área interna em hipótese nenhuma — e a checagem vem
    // ANTES de qualquer permissão porque ele não participa deste sistema: o
    // portal tem sessão e escopo próprios, e ele não tem linha em
    // `user_permissions`. Sem isto, um cliente logado aqui cairia no mapa
    // vazio e veria a tela de acesso negado em vez de voltar para o portal.
    if (this.auth.getUserRoles().includes(CLIENT_ROLE)) {
      this.auth.logout();
      this.router.navigate(['/cliente']);
      return of(false);
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

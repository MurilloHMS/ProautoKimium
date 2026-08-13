import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Papel do portal do cliente. Nunca entra na área interna. */
const CLIENT_ROLE = 'CLIENTE';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login']);
      return false;
    }

    const userRoles = this.auth.getUserRoles();

    // Cliente não entra na área interna em hipótese nenhuma — e a checagem
    // vem ANTES das roles da rota porque a maioria delas não declara role
    // nenhuma: sem isto, um cliente logado aqui veria todas essas telas.
    if (userRoles.includes(CLIENT_ROLE)) {
      this.auth.logout();
      this.router.navigate(['/cliente']);
      return false;
    }

    const requiredRoles = route.data?.['roles'] as string[] | undefined;

    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.some(r => userRoles.includes(r));

      if(!hasRole){
        this.router.navigate(['/unauthorized']);
        return false;
      }
    }
    return true;
  }
}

import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login']);
      return false;
    }

    const requiredRoles = route.data?.['roles'] as string[] | undefined;

    if (requiredRoles && requiredRoles.length > 0) {
      const userRoles = this.auth.getUserRoles();
      const hasRole = requiredRoles.some(r => userRoles.includes(r));

      if(!hasRole){
        this.router.navigate(['/unauthorized']);
        return false;
      }
    }
    return true;
  }
}

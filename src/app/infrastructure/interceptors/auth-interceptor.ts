import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ClientAuthService } from '../services/client/client-auth.service';

@Injectable({ providedIn: 'root' })
export class AuthInterceptor implements HttpInterceptor {

  constructor(
    private authService: AuthService,
    private clientAuthService: ClientAuthService,
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const publicEndponts = [
      '/auth/login',
    ];

    const isPublic = publicEndponts.some(url => req.url.includes(url));

    if(isPublic){
      return next.handle(req);
    }

    // Duas sessões podem coexistir no mesmo navegador: o funcionário no ERP e
    // o cliente no portal. A URL decide qual token vai — mandar o do ERP para
    // `/api/client` daria 403, e mandar o do cliente para o resto vazaria a
    // sessão do portal em telas que não são dele.
    const token = req.url.includes('/client/')
      ? this.clientAuthService.getToken()
      : this.authService.getToken();

    if (token) {
      const cloned = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
      return next.handle(cloned);
    }
    return next.handle(req);
  }
}

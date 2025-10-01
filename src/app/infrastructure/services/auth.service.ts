import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { map, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(private http: HttpClient) { }

  login(login: string, password: string){
    this.logout();
    return this.http.post<any>(`${environment.apiUrl}/auth/login`, {login, password}).pipe(
      tap(response => {
        localStorage.setItem('token', response.token);
      })
    );
  }

  logout(){
    localStorage.removeItem('token');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isLoggedIn(): boolean {
    const expDate = this.getExpirationDate();
    if (!expDate){
      this.logout();
      return false;
    }

    return expDate > new Date();
  }

  getUserRoles(): string[] {
    const token = this.getToken();
    if(!token) return [];

    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.roles || [];
  }

  getExpirationDate(): Date | null {
    const payload = this.decodeToken();
    if (!payload || !payload.exp) return null;

    return new Date(payload.exp * 1000);
  }

 getStockControlToken(): Observable<string> {
    return this.http.post<{ token: string }>(
      `${environment.apiUrl}/auth/app-token`,
      {}
    ).pipe(
      map(response => response.token)
    );
  }


  private decodeToken(): any{
    const token = this.getToken();
    if(!token) return null;

    try{
      return JSON.parse(atob(token.split('.')[1]));
    }catch(e){
      return null;
    }
  }
}

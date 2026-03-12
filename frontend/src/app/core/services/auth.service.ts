import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { User, AuthResponse } from '../models/taripa.models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http   = inject(HttpClient);
  private router = inject(Router);

  private _user   = signal<User | null>(this.loadUserFromStorage());
  private _token  = signal<string | null>(localStorage.getItem('taripa_token'));

  readonly user        = this._user.asReadonly();
  readonly token       = this._token.asReadonly();
  readonly isLoggedIn  = computed(() => !!this._token());
  readonly isAdmin     = computed(() => this._user()?.role === 'admin');

  private loadUserFromStorage(): User | null {
    const raw = localStorage.getItem('taripa_user');
    return raw ? JSON.parse(raw) : null;
  }

  register(email: string, password: string, displayName?: string) {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/register`, {
      email, password, display_name: displayName,
    }).pipe(tap(res => this.persist(res)));
  }

  login(email: string, password: string) {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, {
      email, password,
    }).pipe(tap(res => this.persist(res)));
  }

  logout() {
    localStorage.removeItem('taripa_token');
    localStorage.removeItem('taripa_user');
    this._token.set(null);
    this._user.set(null);
    this.router.navigate(['/']);
  }

  updateTrustedContact(name: string, phone: string) {
    return this.http.patch(`${environment.apiUrl}/auth/trusted-contact`, {
      trusted_contact_name: name,
      trusted_contact_phone: phone,
    }).pipe(tap(() => {
      const u = this._user();
      if (u) {
        const updated = { ...u, trusted_contact_name: name, trusted_contact_phone: phone };
        this._user.set(updated);
        localStorage.setItem('taripa_user', JSON.stringify(updated));
      }
    }));
  }

  private persist(res: AuthResponse) {
    localStorage.setItem('taripa_token', res.token);
    localStorage.setItem('taripa_user', JSON.stringify(res.user));
    this._token.set(res.token);
    this._user.set(res.user);
  }
}

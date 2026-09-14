import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse } from '../models/api.models';

const TOKEN_KEY = 'agrichain_token';
const EMAIL_KEY = 'agrichain_email';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly base = environment.apiBaseUrl;

  private readonly tokenSig = signal<string | null>(this.readStorage(TOKEN_KEY));
  private readonly emailSig = signal<string | null>(this.readStorage(EMAIL_KEY));

  readonly token = computed(() => this.tokenSig());
  readonly email = computed(() => this.emailSig());
  readonly isAuthenticated = computed(() => !!this.tokenSig());

  constructor(private http: HttpClient) {}

  private readStorage(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.base}/auth/login`, { email, password })
      .pipe(tap((res) => this.setSession(res)));
  }

  register(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.base}/auth/register`, { email, password })
      .pipe(tap((res) => this.setSession(res)));
  }

  private setSession(res: AuthResponse): void {
    const token = res?.token ?? '';
    const email = res?.email ?? '';
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(EMAIL_KEY, email);
    } catch {
      /* ignore storage failures */
    }
    this.tokenSig.set(token || null);
    this.emailSig.set(email || null);
  }

  logout(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(EMAIL_KEY);
    } catch {
      /* ignore */
    }
    this.tokenSig.set(null);
    this.emailSig.set(null);
  }
}

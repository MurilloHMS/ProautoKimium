import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

export type AppTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme';
const DARK_CLASS = 'dark-mode';

/**
 * Controla o tema claro/escuro do app.
 *
 * A classe `dark-mode` é aplicada no <html> porque é exatamente o
 * `darkModeSelector` configurado no PrimeNG (app.config.ts) — assim os
 * componentes do PrimeNG e os tokens de `_tokens.scss` trocam juntos.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {

  private readonly document = inject(DOCUMENT);

  private readonly _theme = signal<AppTheme>(this.resolveInitialTheme());

  readonly theme = this._theme.asReadonly();
  readonly isDark = computed(() => this._theme() === 'dark');

  constructor() {
    effect(() => {
      const isDark = this._theme() === 'dark';
      this.document.documentElement.classList.toggle(DARK_CLASS, isDark);
      localStorage.setItem(STORAGE_KEY, this._theme());
    });
  }

  toggle(): void {
    this._theme.update(current => (current === 'dark' ? 'light' : 'dark'));
  }

  set(theme: AppTheme): void {
    this._theme.set(theme);
  }

  /** Preferência salva > preferência do sistema > claro. */
  private resolveInitialTheme(): AppTheme {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;

    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}

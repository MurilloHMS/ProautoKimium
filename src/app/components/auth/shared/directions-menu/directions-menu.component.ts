import { Component, ElementRef, HostListener, computed, inject, input, signal } from '@angular/core';

import { Coordinates, directionsLinks } from '../../../../domain/utils/address';

/**
 * "Como chegar": Waze, Google Maps e Apple Maps pelo endereço em texto, e o
 * Uber quando há coordenada — só ele exige (ver `uberLink`).
 *
 * Links comuns (`<a target="_blank">`), e não `window.open` num clique: no
 * celular o link universal é o que abre o app instalado em vez do site.
 */
@Component({
  selector: 'app-directions-menu',
  standalone: true,
  template: `
    <div class="como-chegar">
      <button type="button" class="como-chegar__botao" [class.como-chegar__botao--claro]="light()"
              [attr.aria-expanded]="aberto()" (click)="aberto.set(!aberto())">
        <i class="pi pi-directions"></i> {{ label() }}
      </button>
      @if (aberto()) {
        <div class="como-chegar__menu" role="menu">
          <span class="como-chegar__rotulo">Abrir em</span>
          <a role="menuitem" [href]="links().waze" target="_blank" rel="noopener" (click)="aberto.set(false)">
            <i class="pi pi-send"></i> Waze</a>
          <a role="menuitem" [href]="links().googleMaps" target="_blank" rel="noopener" (click)="aberto.set(false)">
            <i class="pi pi-map"></i> Google Maps</a>
          <a role="menuitem" [href]="links().appleMaps" target="_blank" rel="noopener" (click)="aberto.set(false)">
            <i class="pi pi-apple"></i> Apple Maps</a>
          @if (links().uber; as uber) {
            <a role="menuitem" [href]="uber" target="_blank" rel="noopener" (click)="aberto.set(false)">
              <i class="pi pi-car"></i> Uber</a>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: inline-block; }
    .como-chegar { position: relative; }
    .como-chegar__botao {
      display: inline-flex; align-items: center; gap: 6px; height: var(--btn-h-md); padding: 0 12px;
      border: 1px solid var(--app-border-strong); border-radius: var(--radius-control);
      background: var(--app-surface); color: var(--app-action); font: inherit; font-size: var(--text-ui);
      font-weight: 600; cursor: pointer;
      &:hover { background: var(--app-action-soft); }
      &:focus-visible { outline: 2px solid var(--app-action); outline-offset: 2px; }
    }
    .como-chegar__botao--claro {
      background: rgba(255,255,255,.14); border-color: rgba(255,255,255,.4); color: #fff;
      &:hover { background: rgba(255,255,255,.24); }
    }
    .como-chegar__menu {
      position: absolute; z-index: 30; top: calc(100% + 4px); left: 0; min-width: 200px;
      display: flex; flex-direction: column; padding: 4px; background: var(--app-surface);
      border: 1px solid var(--app-border); border-radius: var(--radius-control); box-shadow: var(--app-shadow-overlay);
      a {
        display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 10px; border-radius: 6px;
        color: var(--app-text); text-decoration: none; font-size: var(--text-ui);
        &:hover, &:focus-visible { background: var(--app-surface-2); outline: none; }
        i { color: var(--app-text-muted); }
      }
    }
    .como-chegar__rotulo {
      padding: 4px 10px 2px; font-size: var(--text-micro); font-weight: 600;
      letter-spacing: var(--tracking-head); text-transform: uppercase; color: var(--app-text-subtle);
    }
  `],
})
export class DirectionsMenuComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly address = input.required<string>();
  /**
   * O ponto do endereço, quando o Nominatim achou.
   *
   * Sem ele o Uber some do menu: o link universal da Uber roteia por coordenada
   * e o endereço em texto é só o rótulo do pino, então o botão abriria o app
   * pedindo o destino.
   */
  readonly coords = input<Coordinates | null>(null);
  readonly label = input('Como chegar');
  /** Sobre a capa escura do evento. */
  readonly light = input(false);

  readonly aberto = signal(false);
  readonly links = computed(() => directionsLinks(this.address(), this.coords()));

  @HostListener('document:click', ['$event'])
  fecharFora(event: MouseEvent): void {
    if (this.aberto() && !this.host.nativeElement.contains(event.target as Node)) {
      this.aberto.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  fecharEsc(): void {
    this.aberto.set(false);
  }
}

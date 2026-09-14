import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { mapEmbedUrl } from '../../../../domain/utils/address';

/**
 * O mapa do Google pelo endereço em texto, sem chave (decisão dele).
 *
 * `bypassSecurityTrustResourceUrl` só recebe URL montada por `mapEmbedUrl`, com
 * o endereço passado por `encodeURIComponent` — nunca texto cru do usuário na
 * URL. É a única forma de o Angular aceitar `src` dinâmico num `<iframe>`.
 *
 * `loading="lazy"`: numa lista de palestras fora da empresa, só carrega o mapa
 * que chega na tela.
 */
@Component({
  selector: 'app-map-preview',
  standalone: true,
  template: `
    @if (url(); as src) {
      <iframe class="mapa" [src]="src" [title]="'Mapa: ' + address()" loading="lazy"
              referrerpolicy="no-referrer-when-downgrade" [style.height.px]="height()"></iframe>
    } @else {
      <div class="mapa mapa--vazio" [style.height.px]="height()">
        <i class="pi pi-map-marker"></i>
        <span>{{ emptyText() }}</span>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .mapa {
      display: flex; width: 100%; border: 1px solid var(--app-border);
      border-radius: var(--radius-surface); background: var(--app-surface-2);
    }
    .mapa--vazio {
      flex-direction: column; align-items: center; justify-content: center; gap: 6px;
      color: var(--app-text-subtle); font-size: var(--text-ui-sm); text-align: center; padding: 12px;
      i { font-size: 1.4rem; }
    }
  `],
})
export class MapPreviewComponent {
  private readonly sanitizer = inject(DomSanitizer);

  /** O texto já formatado ("Av. Colombo, 5790 - Zona 7, Maringá - PR"). */
  readonly address = input<string | null | undefined>('');
  readonly height = input(200);
  readonly emptyText = input('Preencha rua e cidade para ver no mapa');

  readonly url = computed<SafeResourceUrl | null>(() => {
    const texto = (this.address() ?? '').trim();
    return texto ? this.sanitizer.bypassSecurityTrustResourceUrl(mapEmbedUrl(texto)) : null;
  });
}

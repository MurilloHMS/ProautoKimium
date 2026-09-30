import { Component, input, model } from '@angular/core';

/**
 * Sim / Não em dois botões grandes — no lugar da chave e da caixinha, que são
 * pequenas e ambíguas para quem tem pouca intimidade com o celular. Vazio até
 * a pessoa escolher: não responder é diferente de responder "não".
 */
@Component({
  selector: 'ck-sim-nao',
  standalone: true,
  template: `
    <div class="sn" role="group" [attr.aria-label]="rotulo()">
      <button type="button" class="sn__op" [class.is-on]="valor() === true" [attr.aria-pressed]="valor() === true"
              (click)="valor.set(true)">{{ sim() }}</button>
      <button type="button" class="sn__op" [class.is-on]="valor() === false" [attr.aria-pressed]="valor() === false"
              (click)="valor.set(false)">{{ nao() }}</button>
    </div>
  `,
  styles: `
    .sn { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .sn__op {
      height: 56px;
      border: 1.5px solid var(--app-border-strong);
      border-radius: 14px;
      background: var(--app-surface);
      color: var(--app-text);
      font: inherit;
      font-size: 17px;
      font-weight: 700;
      cursor: pointer;
      transition: background-color .15s ease, border-color .15s ease;

      &.is-on { border-color: var(--app-action); background: var(--app-action-soft); color: var(--app-action); box-shadow: inset 0 0 0 1px var(--app-action); }
      &:focus-visible { outline: none; box-shadow: var(--app-focus-ring); }
    }
    @media (prefers-reduced-motion: reduce) { .sn__op { transition: none; } }
  `,
})
export class SimNaoComponent {
  readonly valor = model<boolean | null>(null);
  readonly rotulo = input('');
  readonly sim = input('Sim');
  readonly nao = input('Não');
}

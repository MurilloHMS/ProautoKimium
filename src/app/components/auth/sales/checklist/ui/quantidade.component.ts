import { Component, computed, input, model } from '@angular/core';

/**
 * − número + — tocar é mais fácil que abrir o teclado e apagar o que estava.
 * Botões de 48px; o número tem nome para o leitor de tela.
 */
@Component({
  selector: 'ck-quantidade',
  standalone: true,
  template: `
    <div class="qt" role="group" [attr.aria-label]="'Quantidade de ' + rotulo()">
      <button type="button" class="qt__b" [disabled]="valor() <= minimo()" [attr.aria-label]="'Tirar um de ' + rotulo()"
              (click)="valor.set(valor() - 1)">−</button>
      <output class="qt__n" aria-live="polite">{{ valor() }}</output>
      <button type="button" class="qt__b" [attr.aria-label]="'Pôr mais um de ' + rotulo()"
              (click)="valor.set(valor() + 1)">+</button>
    </div>
  `,
  styles: `
    :host { flex: none; }
    .qt {
      display: inline-flex;
      align-items: center;
      border: 1.5px solid var(--app-border-strong);
      border-radius: 12px;
      background: var(--app-surface);
      overflow: hidden;
    }
    .qt__b {
      width: 48px;
      height: 48px;
      border: 0;
      background: transparent;
      color: var(--app-action);
      font: inherit;
      font-size: 24px;
      font-weight: 700;
      cursor: pointer;

      &:disabled { color: var(--app-text-subtle); cursor: default; }
      &:focus-visible { outline: none; box-shadow: inset var(--app-focus-ring); }
    }
    .qt__n { min-width: 40px; text-align: center; font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
  `,
})
export class QuantidadeComponent {
  readonly valor = model(0);
  readonly minimo = input(0);
  readonly rotulo = input('item');
}

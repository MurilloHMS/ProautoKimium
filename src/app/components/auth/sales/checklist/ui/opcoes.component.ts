import { Component, input, model } from '@angular/core';

/** Escolha única em botões grandes, duas colunas: tipo de máquina, tipo de mesa. */
@Component({
  selector: 'ck-opcoes',
  standalone: true,
  template: `
    <div class="op" role="radiogroup" [attr.aria-label]="rotulo()">
      @for (o of opcoes(); track o.valor) {
        <button type="button" role="radio" class="op__b" [class.is-on]="valor() === o.valor"
                [attr.aria-checked]="valor() === o.valor" (click)="valor.set(o.valor)">{{ o.rotulo }}</button>
      }
    </div>
  `,
  styles: `
    .op { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .op__b {
      min-height: 56px;
      padding: 6px 10px;
      border: 1.5px solid var(--app-border-strong);
      border-radius: 14px;
      background: var(--app-surface);
      color: var(--app-text);
      font: inherit;
      font-size: 16px;
      font-weight: 700;
      line-height: 1.2;
      cursor: pointer;

      &.is-on { border-color: var(--app-action); background: var(--app-action-soft); color: var(--app-action); box-shadow: inset 0 0 0 1px var(--app-action); }
      &:focus-visible { outline: none; box-shadow: var(--app-focus-ring); }
    }
  `,
})
export class OpcoesComponent<T extends string> {
  readonly opcoes = input.required<{ valor: T; rotulo: string }[]>();
  readonly valor = model<T | null>(null);
  readonly rotulo = input('');
}

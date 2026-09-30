import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { Select } from 'primeng/select';
import { NO_CELULAR, larguraDaJanela, providersDeTeste, restaurarLargura } from '../../../../../testing/test-setup';
import { PkComboboxComponent } from '../pk-combobox/pk-combobox.component';
import { PkSheetComponent } from './pk-sheet.component';

@Component({
  standalone: true,
  imports: [PkSheetComponent, PkComboboxComponent, FormsModule],
  template: `
    <pk-sheet [open]="true" title="Embaixo"><div pkSheetBody>folha de baixo</div></pk-sheet>
    <pk-sheet [open]="true" [stacked]="true" title="Em cima">
      <div pkSheetBody>
        <pk-combobox label="Situação" [options]="opcoes" optionLabel="nome" optionValue="id" [(ngModel)]="valor" />
      </div>
    </pk-sheet>`,
})
class FolhaComListaComponent {
  opcoes = [{ id: 1, nome: 'Ativo' }, { id: 2, nome: 'Inativo' }, { id: 3, nome: 'Suspenso' }];
  valor: number | null = null;
}

/**
 * A lista do PrimeNG vai para o `body` e ganha z-index inline. Com a base
 * padrão (1000) ela abria ATRÁS da folha que a chamou — o calendário do
 * reembolso foi o primeiro relato, e a mesma coisa valia para toda lista em
 * folha no celular. A folha EMPILHADA (1060) é o pior caso.
 */
describe('pk-sheet · painéis do PrimeNG abrem por cima', () => {
  afterEach(() => {
    restaurarLargura();
    document.querySelectorAll('.p-select-overlay').forEach(e => e.closest('.p-overlay')?.remove() ?? e.remove());
  });

  it('a lista do pk-combobox numa folha empilhada fica na camada de cima', async () => {
    larguraDaJanela(NO_CELULAR);
    TestBed.configureTestingModule({ imports: [FolhaComListaComponent], providers: providersDeTeste() });
    const fixture = TestBed.createComponent(FolhaComListaComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();

    // Abre pela API: o que está em teste é ONDE a lista cai, não o clique. O
    // p-overlay pendura a lista no body no whenStable e, um quadro depois, o
    // Karma a fecha — então a medida é feita ali, medido e não suposto.
    (fixture.debugElement.query(By.directive(Select)).componentInstance as Select).show(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const painel = document.querySelector('.p-select-overlay') as HTMLElement;
    const folha = document.querySelector('.pk-sheet--sobreposta') as HTMLElement;
    expect(painel).withContext('a lista abriu').not.toBeNull();
    // O z-index fica no invólucro que o p-overlay pendura no body, não na lista.
    let camada: HTMLElement = painel;
    while (camada.parentElement && camada.parentElement !== document.body) camada = camada.parentElement;
    expect(camada.parentElement).withContext('a lista foi para o body').toBe(document.body);
    expect(Number(getComputedStyle(camada).zIndex)).toBeGreaterThan(Number(getComputedStyle(folha).zIndex));

    // Sem "o toque cai na lista" aqui: neste instante o PrimeNG ainda não virou
    // a lista para cima, e ela está abaixo da janela do Karma (437px de altura) —
    // o toque mediria a posição, não a camada. Quem mede o toque, com a mesma
    // configuração global, é o teste do calendário do reembolso.
    fixture.nativeElement.remove();
  });
});

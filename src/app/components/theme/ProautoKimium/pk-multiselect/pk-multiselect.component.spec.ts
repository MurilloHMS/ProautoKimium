import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';

import { PkMultiselectComponent } from './pk-multiselect.component';

@Component({
  standalone: true,
  imports: [FormsModule, PkMultiselectComponent],
  template: `
    <div id="caixa" style="width: 300px">
      <pk-multiselect [options]="opcoes" optionLabel="label" optionValue="id" [ngModel]="marcados()" [ngModelOptions]="{ standalone: true }" />
    </div>`,
})
class HostComponent {
  readonly opcoes = [
    { id: 'a', label: 'Aguinaldo de Castro Luz · Proauto Kimium Indústria e Comércio de Lubrificantes Ltda · Departamento Técnico' },
    { id: 'b', label: 'Bruno' }, { id: 'c', label: 'Carla' }, { id: 'd', label: 'Diego' },
  ];
  readonly marcados = signal<string[]>(['a']);
}

/**
 * O seletor nunca passa da largura do campo (2026-10-08): uma ficha com
 * "nome · empresa · setor" esticava o controle até 909px numa coluna de 340, e
 * a coluna rolava para o lado.
 */
describe('PkMultiselectComponent', () => {
  async function montar(marcados: string[]) {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection(), provideAnimationsAsync(), providePrimeNG()],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.marcados.set(marcados);
    document.body.appendChild(fixture.nativeElement);
    // O ngModel aplica o valor numa volta seguinte: espera até ele chegar ao controle.
    for (let i = 0; i < 4; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
    return fixture.nativeElement as HTMLElement;
  }

  it('uma ficha de rótulo longo não estica o campo: corta com reticências e o "x" continua à vista', async () => {
    const el = await montar(['a']);
    const caixa = el.querySelector<HTMLElement>('#caixa')!;
    const campo = el.querySelector<HTMLElement>('.p-multiselect')!;
    const remover = el.querySelector<HTMLElement>('.p-chip-remove-icon');
    expect(el.querySelector('.p-chip')).withContext('a ficha precisa existir, senão o teste não prova nada').not.toBeNull();

    expect(caixa.scrollWidth).withContext('a caixa de 300px não pode rolar para o lado').toBeLessThanOrEqual(caixa.clientWidth);
    expect(campo.getBoundingClientRect().width).toBeLessThanOrEqual(300);
    expect(remover!.getBoundingClientRect().right).toBeLessThanOrEqual(campo.getBoundingClientRect().right);
    el.remove();
  });

  it('com mais de três marcados, a contagem vem em português', async () => {
    const el = await montar(['a', 'b', 'c', 'd']);
    expect(el.textContent).toContain('4 selecionados');
    el.remove();
  });
});

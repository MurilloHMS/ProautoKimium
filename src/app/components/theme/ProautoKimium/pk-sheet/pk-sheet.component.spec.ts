import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PkSheetComponent } from './pk-sheet.component';
import { providersDeTeste } from '../../../../../testing/test-setup';

@Component({
  standalone: true,
  imports: [PkSheetComponent],
  template: `
    <pk-sheet [open]="aberto()" title="Editar palestra" (closed)="fechou = fechou + 1">
      <div pkSheetBody><p id="corpo">Campos</p></div>
      <div pkSheetFooter><button id="salvar">Salvar</button></div>
    </pk-sheet>
  `,
})
class Host {
  aberto = signal(false);
  fechou = 0;
}

describe('PkSheetComponent', () => {

  async function montar() {
    await TestBed.configureTestingModule({ imports: [Host], providers: providersDeTeste() }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return fixture;
  }

  it('fechada, não existe no DOM', async () => {
    const f = await montar();

    expect(f.nativeElement.querySelector('.pk-sheet')).toBeNull();
  });

  /**
   * A projeção é por atributo. Um slot sem o atributo, ou um `@if` em volta
   * dele, abre a folha vazia com build verde.
   */
  it('aberta, projeta o corpo e o pé', async () => {
    const f = await montar();
    f.componentInstance.aberto.set(true);
    await f.whenStable();

    expect(f.nativeElement.querySelector('.pk-sheet__miolo #corpo')).not.toBeNull();
    expect(f.nativeElement.querySelector('.pk-sheet__pe #salvar')).not.toBeNull();
    expect(f.nativeElement.querySelector('.pk-sheet__titulo').textContent).toContain('Editar palestra');
  });

  it('clicar no véu fecha; clicar dentro, não', async () => {
    const f = await montar();
    f.componentInstance.aberto.set(true);
    await f.whenStable();

    (f.nativeElement.querySelector('#corpo') as HTMLElement).click();
    expect(f.componentInstance.fechou).toBe(0);

    (f.nativeElement.querySelector('.pk-sheet') as HTMLElement).click();
    expect(f.componentInstance.fechou).toBe(1);
  });

  it('Esc fecha', async () => {
    const f = await montar();
    f.componentInstance.aberto.set(true);
    await f.whenStable();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(f.componentInstance.fechou).toBe(1);
  });
});

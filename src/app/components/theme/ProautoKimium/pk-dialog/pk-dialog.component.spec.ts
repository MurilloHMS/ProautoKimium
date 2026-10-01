import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, provideZonelessChangeDetection, signal } from '@angular/core';

import { PkDialogComponent } from './pk-dialog.component';
import { providersDeTeste } from '../../../../../testing/test-setup';

describe('PkDialogComponent', () => {
  let component: PkDialogComponent;
  let fixture: ComponentFixture<PkDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
      imports: [PkDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PkDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

@Component({
  standalone: true,
  imports: [PkDialogComponent],
  template: `
    <pk-dialog header="Teste" [visible]="true" [flush]="flush()">
      <div pkDialogContent data-testid="conteudo">
        <p data-testid="primeiro">Primeiro bloco</p>
        <p data-testid="segundo">Segundo bloco</p>
      </div>
    </pk-dialog>`,
})
class HospedeiroComponent {
  readonly flush = signal(false);
}

/** Sem `[flush]` nenhum: é o caso de todo diálogo novo, e o que o padrão tem de cobrir. */
@Component({
  standalone: true,
  imports: [PkDialogComponent],
  template: `
    <pk-dialog header="Teste" [visible]="true">
      <div pkDialogContent data-testid="conteudo">
        <p data-testid="primeiro">Primeiro bloco</p>
        <p data-testid="segundo">Segundo bloco</p>
      </div>
    </pk-dialog>`,
})
class HospedeiroSemFlushComponent {}

/**
 * O corpo padrão do diálogo. Antes ele era opcional (`.pk-dialog-body`) e todo
 * diálogo novo esquecia: abria com os componentes colados nas bordas e entre si.
 * Agora vem por padrão, e só quem traz o próprio espaçamento pede `flush`.
 */
describe('PkDialogComponent · corpo padrão', () => {
  async function montar(flush: boolean | 'sem-pedir') {
    await TestBed.configureTestingModule({ imports: [HospedeiroComponent, HospedeiroSemFlushComponent], providers: providersDeTeste() }).compileComponents();
    const fixture = flush === 'sem-pedir'
      ? TestBed.createComponent(HospedeiroSemFlushComponent)
      : TestBed.createComponent(HospedeiroComponent);
    if (flush !== 'sem-pedir') (fixture.componentInstance as HospedeiroComponent).flush.set(flush);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const px = (el: Element, prop: string) => parseFloat(getComputedStyle(el).getPropertyValue(prop));
  const el = (id: string) => document.querySelector(`[data-testid="${id}"]`)!;

  afterEach(() => document.querySelectorAll('.p-dialog-mask').forEach(m => m.remove()));

  it('sem pedir nada, o conteúdo ganha margem nas bordas e espaço entre os blocos', async () => {
    await montar('sem-pedir');
    const corpo = el('conteudo').parentElement!;

    expect(px(corpo, 'padding-top')).toBe(20);
    expect(px(corpo, 'padding-left')).toBe(24);
    expect(px(el('conteudo'), 'row-gap')).toBe(16);
    expect(px(el('primeiro'), 'margin-bottom')).withContext('a margem do <p> não soma ao gap').toBe(0);

    const distancia = el('segundo').getBoundingClientRect().top - el('primeiro').getBoundingClientRect().bottom;
    expect(distancia).toBe(16);
  });

  it('flush: o conteúdo encosta, para quem traz o próprio espaçamento', async () => {
    await montar(true);
    const corpo = el('conteudo').parentElement!;

    expect(px(corpo, 'padding-top')).toBe(0);
    expect(getComputedStyle(el('conteudo')).display).not.toBe('flex');
  });
});

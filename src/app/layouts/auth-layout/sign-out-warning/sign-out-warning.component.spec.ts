import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { NO_CELULAR, NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura } from '../../../../testing/test-setup';
import { AuthService } from '../../../infrastructure/services/auth.service';
import { SignOutService } from '../../../infrastructure/services/sign-out.service';
import { ChecklistOfflineStore } from '../../../infrastructure/state/checklist-offline.store';
import { SignOutWarningComponent } from './sign-out-warning.component';

/** O aviso de saída: diz o que ficou, onde ficou, e o que dá para fazer agora. */
describe('SignOutWarningComponent', () => {
  let fixture: ComponentFixture<SignOutWarningComponent>;
  let el: HTMLElement;
  let out: SignOutService;
  const online = signal(true);

  function montar(largura: number): void {
    larguraDaJanela(largura);
    online.set(true);
    TestBed.configureTestingModule({
      imports: [SignOutWarningComponent],
      providers: providersDeTeste([
        { provide: AuthService, useValue: { logoutRemoto: () => of(void 0) } },
        { provide: ChecklistOfflineStore, useValue: { online, sincronizar: () => Promise.resolve(),
          pendingItems: () => Promise.resolve({ waiting: 0, refused: 0, drafts: 0 }) } },
      ]),
    });
    fixture = TestBed.createComponent(SignOutWarningComponent);
    el = fixture.nativeElement as HTMLElement;
    out = TestBed.inject(SignOutService);
    spyOn(out, 'goHome');
    fixture.detectChanges(false);
  }

  const botoes = () => Array.from(el.querySelectorAll<HTMLElement>('pk-button')).map(b => b.textContent!.trim());
  const botao = (texto: string) => Array.from(el.querySelectorAll<HTMLElement>('pk-button button')).find(b => b.textContent!.includes(texto))!;

  afterEach(() => restaurarLargura());

  it('fechado, não mostra nada', () => {
    montar(NO_CELULAR);
    expect(el.textContent!.trim()).toBe('');
  });

  it('no celular: folha com a contagem, onde ficou, e "Enviar agora" primeiro', () => {
    montar(NO_CELULAR);
    out.warning.set({ waiting: 2, refused: 1, drafts: 1 });
    fixture.detectChanges(false);

    expect(el.querySelector('.pk-sheet')).not.toBeNull();
    const texto = el.textContent!;
    expect(texto).toContain('Tem checklist que não foi enviado');
    expect(texto).toContain('2 checklists esperando internet para enviar');
    expect(texto).toContain('1 checklist com problema para corrigir');
    expect(texto).toContain('1 checklist em preenchimento');
    expect(texto).toContain('entrar de novo neste mesmo aparelho');
    expect(botoes()).toEqual(['Enviar agora', 'Continuar no sistema', 'Sair mesmo assim']);
    // Relato dele no campo de data: nada pode passar da tela no celular.
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });

  it('sem internet: não oferece "Enviar agora" e diz por quê', () => {
    montar(NO_CELULAR);
    online.set(false);
    out.warning.set({ waiting: 1, refused: 0, drafts: 0 });
    fixture.detectChanges(false);

    expect(el.textContent).toContain('Sem internet agora: não dá para enviar.');
    expect(botoes()).toEqual(['Continuar no sistema', 'Sair mesmo assim']);
  });

  it('só rascunho: "Abrir os checklists" leva à tela e fecha o aviso', () => {
    montar(NO_CELULAR);
    const nav = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    out.warning.set({ waiting: 0, refused: 0, drafts: 1 });
    fixture.detectChanges(false);

    botao('Abrir os checklists').click();
    expect(nav).toHaveBeenCalledWith('/vendas/checklist');
    expect(out.warning()).toBeNull();
  });

  it('"Sair mesmo assim" sai; "Continuar no sistema" só fecha', () => {
    montar(NO_CELULAR);
    out.warning.set({ waiting: 1, refused: 0, drafts: 0 });
    fixture.detectChanges(false);
    botao('Continuar no sistema').click();
    expect(out.warning()).toBeNull();
    expect(out.goHome).not.toHaveBeenCalled();

    out.warning.set({ waiting: 1, refused: 0, drafts: 0 });
    fixture.detectChanges(false);
    botao('Sair mesmo assim').click();
    expect(out.goHome).toHaveBeenCalled();
  });

  it('no computador: diálogo, e não folha', async () => {
    montar(NO_COMPUTADOR);
    out.warning.set({ waiting: 1, refused: 0, drafts: 0 });
    fixture.detectChanges(false);
    await fixture.whenStable();
    expect(el.querySelector('.pk-sheet')).toBeNull();
    expect(el.querySelector('pk-dialog')).not.toBeNull();
    expect(document.body.textContent).toContain('1 checklist esperando internet para enviar');
  });
});

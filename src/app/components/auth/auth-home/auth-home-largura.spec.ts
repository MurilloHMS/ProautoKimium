import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../../../environments/environment';
import { providersDeTeste } from '../../../../testing/test-setup';
import { NotificationService } from '../../../infrastructure/services/notification.service';
import { AuthHomeComponent } from './auth-home.component';

/**
 * Relato dele (2026-09-30, iPhone 16e): os painéis de Notificações e Avisos
 * ficavam mais largos que os cartões de pendência, e a tela rolava para o
 * lado. No celular o `.painel-duplo` é um grid de uma coluna; sem
 * `minmax(0, 1fr)`, a coluna cresce até caber a linha inteira do texto mais
 * comprido — e o texto do aviso é uma linha só, sem quebra.
 */
describe('AuthHomeComponent · largura no celular', () => {

  it('com aviso de texto longo, os painéis não passam da largura dos cartões de pendência', async () => {
    TestBed.configureTestingModule({ imports: [AuthHomeComponent], providers: providersDeTeste() });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(NotificationService).notifications.set([
      { id: 'n1', type: 'GERAL', title: 'Reembolso aprovado', message: 'Seu pedido de reembolso de combustível foi aprovado pelo RH e entra na próxima folha de pagamento.', read: false, createdAt: '2026-09-30T10:00:00' } as never,
    ]);

    const fixture = TestBed.createComponent(AuthHomeComponent);
    const el = fixture.nativeElement as HTMLElement;
    // A largura do iPhone 16e: o componente dentro de uma caixa de 390px.
    el.style.display = 'block';
    el.style.width = '390px';
    document.body.appendChild(el);
    fixture.detectChanges();

    http.expectOne(`${environment.apiUrl}/home/summary`).flush({
      mine: [{ type: 'HOLERITE_PENDING', title: 'Confirmar holerite', detail: 'Setembro', since: '2026-09-29' }],
      approvals: [], vacationBalanceDays: null,
    });
    http.expectOne(`${environment.apiUrl}/hr/announcements`).flush([
      { id: 'a1', title: 'Confraternização de fim de ano', content: 'A confraternização será no dia 12 de dezembro, a partir das 18h, no salão da matriz. Confirme presença com o RH até dia 5, pelo e-mail ou pelo telefone do setor.', publishedByName: 'RH', publishedAt: '2026-09-29T10:00:00' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const largura = (sel: string) => el.querySelector(sel)!.getBoundingClientRect().width;
    const cartao = largura('.pendencias');
    const paineis = Array.from(el.querySelectorAll('.painel')).map(p => p.getBoundingClientRect().width);

    expect(paineis.length).toBe(2);
    for (const w of paineis) {
      expect(w).withContext(`painel ${Math.round(w)}px, cartão ${Math.round(cartao)}px`).toBeLessThanOrEqual(cartao + 0.5);
    }
    expect(el.scrollWidth).withContext('nada passa dos 390px').toBeLessThanOrEqual(390);
    el.remove();
  });
});

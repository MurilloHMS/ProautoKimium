import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { NewsletterHubComponent } from './newsletter-hub.component';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';

/**
 * A casca da newsletter.
 *
 * Eram duas telas no menu para o mesmo trabalho mensal: conferir os números e
 * disparar. Aqui viram duas abas — e o que este arquivo protege é a parte que
 * não se vê, que é **qual aba cada pessoa enxerga**.
 *
 * Confirmar a revisão enche a fila de e-mail da base inteira de clientes. É
 * por isso que a revisão tem tela própria no catálogo mesmo sem rota: para
 * poder ser concedida a quem confere sem ser concedida a quem só acompanha.
 */
describe('NewsletterHubComponent', () => {

  const REVISAO = 'communication/newsletter-revisao';
  const ENVIO = 'communication/newsletter';

  async function montar(telasLiberadas: string[]) {
    await TestBed.configureTestingModule({
      imports: [NewsletterHubComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: PermissionStore,
          useValue: { canOpen: (tela: string) => telasLiberadas.includes(tela) },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(NewsletterHubComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('mostra as duas etapas para quem tem as duas telas', async () => {
    const fixture = await montar([REVISAO, ENVIO]);

    expect(fixture.componentInstance.ferramentas().map(f => f.key))
      .toEqual(['revisao', 'envio']);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.rail__item').length).toBe(2);
  });

  /** Abre onde o mês começa: primeiro se confere, depois se manda. */
  it('começa na revisão', async () => {
    const fixture = await montar([REVISAO, ENVIO]);

    expect(fixture.componentInstance.ativa()).toBe('revisao');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-newsletter-revisao')).not.toBeNull();
  });

  /**
   * **Quem não pode conferir não vê a aba.** Sem este filtro a aba apareceria,
   * a pessoa clicaria, e a API responderia 403 — um beco sem saída que parece
   * defeito do sistema.
   */
  it('esconde a revisão de quem não tem a tela', async () => {
    const fixture = await montar([ENVIO]);

    expect(fixture.componentInstance.ferramentas().map(f => f.key)).toEqual(['envio']);
    expect((fixture.nativeElement as HTMLElement).querySelector('app-newsletter-revisao')).toBeNull();
  });

  /**
   * E cai na aba que sobrou.
   *
   * A aba inicial é a revisão; para quem não a tem, deixar `ativa` nela daria
   * uma tela vazia — menu de um item e conteúdo nenhum, sem nada explicando.
   */
  it('sem a revisão, abre direto no envio', async () => {
    const fixture = await montar([ENVIO]);

    expect(fixture.componentInstance.ativa()).toBe('envio');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-newsletter')).not.toBeNull();
  });

  it('troca de aba ao clicar', async () => {
    const fixture = await montar([REVISAO, ENVIO]);
    const abas = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.rail__item');

    abas[1].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.ativa()).toBe('envio');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-newsletter-revisao'))
      .withContext('a revisão sai do DOM: ela dispara seis consultas ao Sankhya')
      .toBeNull();
  });
});

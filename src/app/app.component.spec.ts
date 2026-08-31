import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';

import { provideServiceWorker } from '@angular/service-worker';
import { providersDeTeste } from '../testing/test-setup';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: providersDeTeste([
        // O AppComponent escuta atualização do service worker. Desligado no
        // teste: o que se verifica aqui é que a casca monta.
        provideServiceWorker('ngsw-worker.js', { enabled: false }),
      ]),
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'proauto-kimium' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('proauto-kimium');
  });

  /**
   * A casca do app é só o `<router-outlet>`.
   *
   * Este teste procurava um `<h1>Hello, proauto-kimium</h1>` — o template que o
   * CLI gera e que foi apagado no primeiro dia do projeto. Ele nunca passou:
   * afirmava algo que nunca foi verdade aqui.
   *
   * O que vale verificar é que a casca monta e tem onde pendurar as rotas. Sem
   * o outlet, nenhuma tela aparece e o erro não diz por quê.
   */
  it('monta a casca com o router-outlet', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });
});

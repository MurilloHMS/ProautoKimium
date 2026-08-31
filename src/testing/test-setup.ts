import { EnvironmentProviders, Provider, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';

// Quem registra o pt-BR na aplicação é o `main.ts`, e teste nenhum roda o
// `main.ts`. Sem isto, qualquer componente com `| date:'…':'pt-BR'` estoura em
// NG0701 — e o erro fala de locale, não de configuração de teste, então quem
// lê procura no lugar errado.
registerLocaleData(localePt);

/**
 * O mínimo que um teste precisa para montar qualquer coisa deste app.
 *
 * Os stubs que o CLI gera vêm com `TestBed.configureTestingModule({})` vazio, e
 * quase todo componente daqui injeta `HttpClient` direta ou indiretamente. O
 * resultado eram **63 testes falhando desde sempre** com `NG0201` — e, pior que
 * as 63 falhas, o ruído: um teste de verdade quebrava no meio delas e ninguém
 * via.
 *
 * Estar num lugar só é o ponto. Colar a lista de providers em 63 arquivos
 * garante que eles divirjam: daqui a três meses metade teria `provideRouter` e
 * a outra metade não, e ninguém saberia qual está certo.
 *
 * **`provideHttpClientTesting` vem depois do `provideHttpClient`**, e a ordem
 * não é estilo: o segundo substitui o backend real pelo de teste. Invertido,
 * o teste faz requisição de verdade — que num CI sem rede vira timeout, e numa
 * máquina com rede vira algo pior.
 */
export function providersDeTeste(
  extras: (Provider | EnvironmentProviders)[] = [],
): (Provider | EnvironmentProviders)[] {
  return [
    provideZonelessChangeDetection(),
    provideNoopAnimations(),
    provideHttpClient(),
    provideHttpClientTesting(),
    // Rotas vazias: quem precisa navegar de verdade declara as suas. O que isto
    // resolve é o `ActivatedRoute` e o `Router` existirem.
    provideRouter([]),
    ...extras,
  ];
}

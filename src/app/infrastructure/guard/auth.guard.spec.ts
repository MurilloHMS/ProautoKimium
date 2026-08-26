import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { AuthGuard } from './auth.guard';

/**
 * O stub gerado pelo CLI tratava o guard como função (`authGuard`). Ele virou
 * classe e o spec nunca foi atualizado — o que derrubava a compilação da suíte
 * INTEIRA, não só deste arquivo.
 */
describe('AuthGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  it('should be created', () => {
    expect(TestBed.inject(AuthGuard)).toBeTruthy();
  });
});

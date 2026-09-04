import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';

import { LoginComponent } from './login.component';
import { FirstAccessComponent } from '../first-access/first-access.component';
import { PASSWORD_PATTERN } from '../../../domain/utils/password-rules';

/**
 * **O login não julga o formato da senha.**
 *
 * Havia no login a mesma regra de complexidade do primeiro acesso, e ela
 * trancava pessoas do lado de fora sem recurso: com o botão desabilitado, não
 * dá nem para tentar, e a API — que é quem sabe se a senha confere — nunca é
 * consultada. A única saída era pedir a um admin para redefinir a senha.
 *
 * Aconteceu em produção: uma usuária definiu a senha pelo primeiro acesso e não
 * conseguiu entrar.
 *
 * Ficam de fora dessa regra mais gente do que parece — quem definiu a senha
 * antes de a regra existir, quem teve a senha definida por um admin, e quem veio
 * pelo portal do cliente, cujas telas **não validam formato**.
 *
 * Complexidade se exige ao **criar** a senha, onde ainda dá para escolher outra.
 */
describe('LoginComponent · a senha', () => {

  async function montar<T>(componente: new (...args: never[]) => T): Promise<T> {
    await TestBed.configureTestingModule({
      imports: [componente as never],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
      ],
    }).compileComponents();

    return TestBed.createComponent(componente as never).componentInstance as T;
  }

  afterEach(() => TestBed.resetTestingModule());

  /** **O teste que pega o defeito.** */
  it('habilita o botão com qualquer senha não vazia', async () => {
    const login = await montar(LoginComponent);

    login.form.setValue({ username: 'murillo', password: 'senha123' });

    expect(login.form.valid)
      .withContext('senha fraca ainda precisa poder ser TENTADA — quem recusa é a API')
      .toBeTrue();
  });

  it('recusa senha vazia, que é a única regra que cabe aqui', async () => {
    const login = await montar(LoginComponent);

    login.form.setValue({ username: 'murillo', password: '' });

    expect(login.form.valid).toBeFalse();
  });

  /**
   * Símbolo fora da lista curta `@$!%*?&#` — como `_`, `-` ou `.` — não passa
   * na regra de complexidade. Se o login a aplicasse, quem tivesse uma senha
   * assim ficaria trancado para sempre.
   */
  it('aceita senha com símbolo fora da lista de complexidade', async () => {
    const login = await montar(LoginComponent);

    login.form.setValue({ username: 'murillo', password: 'Minha_Senha-2026' });

    expect(PASSWORD_PATTERN.test('Minha_Senha-2026'))
      .withContext('a senha realmente não passa na regra de criação')
      .toBeFalse();

    expect(login.form.valid)
      .withContext('e mesmo assim o login tem que deixar tentar')
      .toBeTrue();
  });

  it('username continua obrigatório', async () => {
    const login = await montar(LoginComponent);

    login.form.setValue({ username: '', password: 'QualquerCoisa1!' });

    expect(login.form.valid).toBeFalse();
  });
});

/**
 * O outro lado do contrato: onde a senha **nasce**, a complexidade continua
 * valendo. Tirar a regra do login não pode virar tirar a regra de todo lugar.
 */
describe('FirstAccessComponent · a senha', () => {

  afterEach(() => TestBed.resetTestingModule());

  it('exige complexidade ao criar a senha', async () => {
    await TestBed.configureTestingModule({
      imports: [FirstAccessComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
      ],
    }).compileComponents();

    // `detectChanges` dispara o `ngOnInit`, que e onde o formulario nasce.
    const fixture = TestBed.createComponent(FirstAccessComponent);
    fixture.detectChanges();

    const senha = fixture.componentInstance.passwordForm.get('newPassword');

    senha?.setValue('senha123');
    expect(senha?.valid)
      .withContext('senha fraca não pode ser CRIADA')
      .toBeFalse();

    senha?.setValue('Senha123!');
    expect(senha?.valid)
      .withContext('e a que cumpre a regra passa')
      .toBeTrue();
  });
});

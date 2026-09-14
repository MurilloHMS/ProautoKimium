import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SelectModule } from 'primeng/select';

import { TalentBankEntryDTO } from '../../../domain/models/talent-bank.model';
import { apiMessage } from '../../../domain/utils/api-error';
import { mascararTelefone, apenasDigitosDoTelefone } from '../../../domain/utils/telefone-br';
import {
  PALAVRA_DE_CONFIRMACAO,
  confirmouExclusao,
  erroDoCurriculo,
  formatarData,
  prazoAoRenovar,
  situacaoDaAutorizacao,
} from '../../../domain/utils/talent-bank';
import { VagaService } from '../../../infrastructure/services/processoSeletivo/vaga/vaga.service';
import { TalentBankService } from '../../../infrastructure/services/processoSeletivo/talent-bank/talent-bank.service';

type Estado = 'carregando' | 'aberto' | 'expirado' | 'invalido' | 'falha' | 'apagado';

const AREA_OUTRA = '__outra__';

/**
 * `/meu-curriculo/:token` — o que a pessoa enviou, pelo link do e-mail.
 *
 * Três ausências deliberadas, todas vindas da API:
 * - **o e-mail não se edita**: trocar por token moveria o cadastro para um
 *   endereço que o portador do link controla;
 * - **as candidaturas vêm sem etapa**: "Triagem" ou "Reprovado" criariam
 *   perguntas que o RH teria que responder;
 * - **não há botão "renovar"**: marcar a autorização de novo é a renovação.
 */
@Component({
  selector: 'app-talent-bank-entry',
  standalone: true,
  imports: [FormsModule, RouterLink, SelectModule],
  templateUrl: './talent-bank-entry.component.html',
  styleUrl: './meu-curriculo.scss',
})
export class TalentBankEntryComponent implements OnInit {
  private readonly service = inject(TalentBankService);
  private readonly vagaService = inject(VagaService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly AREA_OUTRA = AREA_OUTRA;
  readonly PALAVRA = PALAVRA_DE_CONFIRMACAO;
  readonly formatarData = formatarData;

  private token = '';

  readonly estado = signal<Estado>('carregando');
  readonly cadastro = signal<TalentBankEntryDTO | null>(null);

  // ── Formulário ────────────────────────────────────────────────────────────
  readonly nome = signal('');
  readonly telefone = signal('');
  readonly linkedin = signal('');
  readonly area = signal<string | null>(null);
  readonly areaOutra = signal('');
  readonly autorizar = signal(false);
  readonly novoCurriculo = signal<File | null>(null);
  readonly erroCurriculo = signal('');

  readonly salvando = signal(false);
  readonly salvo = signal(false);
  readonly erroAoSalvar = signal('');

  readonly opcoesArea = signal<{ label: string; value: string }[]>([{ label: 'Outra', value: AREA_OUTRA }]);

  // ── Apagar ────────────────────────────────────────────────────────────────
  readonly confirmandoExclusao = signal(false);
  readonly textoDeConfirmacao = signal('');
  readonly apagando = signal(false);
  readonly erroAoApagar = signal('');
  readonly podeApagar = computed(() => confirmouExclusao(this.textoDeConfirmacao()) && !this.apagando());

  readonly situacao = computed(() => {
    const c = this.cadastro();
    return c ? situacaoDaAutorizacao(c.consentimentoEm, c.expiraEm, new Date()) : null;
  });

  /** Quem veio de candidatura antiga nunca autorizou: a caixa diz "autorizo", e não "renovar". */
  readonly jaAutorizou = computed(() => !!this.cadastro()?.consentimentoEm);

  readonly prazoNovo = computed(() => prazoAoRenovar(new Date()));

  readonly formularioValido = computed(() =>
    this.nome().trim().length >= 3 &&
    apenasDigitosDoTelefone(this.telefone()).length >= 10 &&
    !this.erroCurriculo(),
  );

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    this.carregar();
    this.carregarAreas();
  }

  carregar(): void {
    if (!this.token) {
      this.estado.set('invalido');
      return;
    }

    this.estado.set('carregando');
    this.service.ver(this.token).subscribe({
      next: (cadastro) => {
        this.preencher(cadastro);
        this.estado.set('aberto');
      },
      error: (err: HttpErrorResponse) => this.estado.set(this.estadoDoErro(err)),
    });
  }

  private carregarAreas(): void {
    this.vagaService.getAreas().subscribe({
      next: (areas) => {
        const unicas = [...new Set(areas.map((a) => a?.trim()).filter(Boolean))].sort();
        this.opcoesArea.set([...unicas.map((a) => ({ label: a, value: a })), { label: 'Outra', value: AREA_OUTRA }]);
        this.encaixarArea(this.cadastro()?.areaInteresse ?? null);
      },
      error: () => {},
    });
  }

  private preencher(c: TalentBankEntryDTO): void {
    this.cadastro.set(c);
    this.nome.set(c.nome ?? '');
    this.telefone.set(mascararTelefone(c.telefone ?? ''));
    this.linkedin.set(c.urlLinkedin ?? '');
    this.autorizar.set(false);
    this.novoCurriculo.set(null);
    this.erroCurriculo.set('');
    this.encaixarArea(c.areaInteresse);
  }

  /** Área escrita à mão num cadastro antigo não está no combo: vira "Outra" com o texto. */
  private encaixarArea(area: string | null): void {
    if (!area) {
      this.area.set(null);
      this.areaOutra.set('');
      return;
    }
    const existe = this.opcoesArea().some((o) => o.value === area);
    this.area.set(existe ? area : AREA_OUTRA);
    this.areaOutra.set(existe ? '' : area);
  }

  aoDigitarTelefone(valor: string): void {
    this.telefone.set(mascararTelefone(valor));
    this.salvo.set(false);
  }

  marcarAlterado(): void {
    this.salvo.set(false);
  }

  aoEscolherCurriculo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const arquivo = input.files?.[0] ?? null;
    this.salvo.set(false);

    if (!arquivo) return;

    const erro = erroDoCurriculo(arquivo);
    if (erro) {
      this.erroCurriculo.set(erro);
      this.novoCurriculo.set(null);
      input.value = '';
      return;
    }

    this.erroCurriculo.set('');
    this.novoCurriculo.set(arquivo);
  }

  descartarNovoCurriculo(input: HTMLInputElement): void {
    input.value = '';
    this.novoCurriculo.set(null);
    this.erroCurriculo.set('');
  }

  salvar(): void {
    if (!this.formularioValido() || this.salvando()) return;

    this.salvando.set(true);
    this.erroAoSalvar.set('');

    const area = this.area() === AREA_OUTRA ? this.areaOutra().trim() || null : this.area();

    this.service
      .atualizar(
        this.token,
        {
          nome: this.nome().trim(),
          telefone: apenasDigitosDoTelefone(this.telefone()),
          urlLinkedin: this.linkedin().trim(),
          areaInteresse: area,
          consentimento: this.autorizar(),
        },
        this.novoCurriculo(),
      )
      .subscribe({
        next: (cadastro) => {
          this.salvando.set(false);
          this.preencher(cadastro);
          this.salvo.set(true);
        },
        error: (err: HttpErrorResponse) => {
          this.salvando.set(false);
          if (err?.status === 410 || err?.status === 404) {
            this.estado.set(this.estadoDoErro(err));
            return;
          }
          this.erroAoSalvar.set(
            err?.status === 413 ? 'O arquivo passa de 10 MB.'
              : err?.status === 400 ? apiMessage(err) ?? 'Confira os dados.'
              : 'Não conseguimos salvar agora. Tente de novo em instantes.',
          );
        },
      });
  }

  baixarCurriculo(): void {
    this.service.baixarCurriculoPorToken(this.token).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `curriculo.${this.cadastro()?.extensaoCurriculo ?? 'pdf'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
      error: (err: HttpErrorResponse) => {
        if (err?.status === 410 || err?.status === 404) this.estado.set(this.estadoDoErro(err));
      },
    });
  }

  pedirExclusao(): void {
    this.textoDeConfirmacao.set('');
    this.erroAoApagar.set('');
    this.confirmandoExclusao.set(true);
  }

  cancelarExclusao(): void {
    this.confirmandoExclusao.set(false);
    this.textoDeConfirmacao.set('');
  }

  apagar(): void {
    // O botão desligado não basta: a palavra é conferida aqui também.
    if (!this.podeApagar()) return;

    this.apagando.set(true);
    this.erroAoApagar.set('');

    this.service.excluirPorToken(this.token).subscribe({
      next: () => {
        this.apagando.set(false);
        this.cadastro.set(null);
        this.estado.set('apagado');
      },
      error: (err: HttpErrorResponse) => {
        this.apagando.set(false);
        if (err?.status === 410 || err?.status === 404) {
          this.estado.set(this.estadoDoErro(err));
          return;
        }
        this.erroAoApagar.set('Não conseguimos apagar agora. Tente de novo em instantes.');
      },
    });
  }

  private estadoDoErro(err: HttpErrorResponse): Estado {
    if (err?.status === 410) return 'expirado';
    if (err?.status === 404) return 'invalido';
    return 'falha';
  }

  quantidadeDeCandidaturas(): number {
    return this.cadastro()?.candidaturas?.length ?? 0;
  }
}

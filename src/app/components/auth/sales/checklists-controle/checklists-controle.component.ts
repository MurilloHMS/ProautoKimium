import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CHECKLIST_EVENT, CHECKLIST_STATUS, ChecklistContent, ChecklistDetail, ChecklistStatus, ChecklistSummary,
} from '../../../../domain/models/sales/checklist.model';
import { apiMessageOrFallback } from '../../../../domain/utils/api-error';
import { normalizar } from '../../../../domain/utils/checklist/checklist-regras';
import { formatarDocumento } from '../../../../infrastructure/validators/documento-br';
import { mascararTelefone } from '../../../../domain/utils/telefone-br';
import { maskZip } from '../../../../domain/utils/address';
import { ChecklistApiService } from '../../../../infrastructure/services/sales/checklist-api.service';
import { ehCelular } from '../../../../infrastructure/state/eh-celular';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';

type Filtro = 'SUBMITTED' | 'CHANGE_REQUESTED' | 'RETURNED' | 'APPROVED' | 'TODOS';
type Acao = 'aprovar' | 'devolver' | 'liberar' | 'negar';

/**
 * Os checklists para a Controladoria (`vendas/checklists`, role CONTRATOS).
 *
 * <p>A lista no padrão das telas novas (chips com contagem na cor do status;
 * "Aguardando análise" é o único sólido, porque é o que pede ação) e, ao lado,
 * o checklist aberto: o que está diferente do Sankhya, o pedido de alteração,
 * os dados para lançar no ERP e o histórico. O comprovante é o PDF.
 */
@Component({
  selector: 'app-checklists-controle',
  standalone: true,
  imports: [PkTableComponent, DatePipe, CurrencyPipe],
  templateUrl: './checklists-controle.component.html',
  styleUrl: './checklists-controle.component.scss',
})
export class ChecklistsControleComponent implements OnInit {

  private readonly api = inject(ChecklistApiService);
  protected readonly celular = ehCelular();

  protected readonly todos = signal<ChecklistSummary[]>([]);
  protected readonly carregando = signal(false);
  protected readonly filtro = signal<Filtro>('SUBMITTED');
  protected readonly busca = signal('');

  protected readonly aberto = signal<ChecklistDetail | null>(null);
  protected readonly abrindo = signal(false);
  protected readonly acao = signal<Acao | null>(null);
  protected readonly notas = signal('');
  protected readonly processando = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected readonly status = CHECKLIST_STATUS;
  protected readonly eventos = CHECKLIST_EVENT;

  protected readonly chips: { valor: Filtro; rotulo: string; tom: string; acao?: boolean }[] = [
    { valor: 'SUBMITTED', rotulo: 'Aguardando análise', tom: 'warning', acao: true },
    { valor: 'CHANGE_REQUESTED', rotulo: 'Pedidos de alteração', tom: 'info' },
    { valor: 'RETURNED', rotulo: 'Devolvidos', tom: 'danger' },
    { valor: 'APPROVED', rotulo: 'Aprovados', tom: 'success' },
    { valor: 'TODOS', rotulo: 'Todos', tom: 'neutral' },
  ];

  protected readonly contagem = computed(() => {
    const c: Record<string, number> = { TODOS: this.todos().length };
    for (const s of this.todos()) c[s.status] = (c[s.status] ?? 0) + 1;
    return c;
  });

  protected readonly lista = computed(() => {
    const f = this.filtro();
    const termos = normalizar(this.busca()).split(' ').filter(Boolean);
    return this.todos().filter(s => {
      if (f !== 'TODOS' && s.status !== f) return false;
      if (!termos.length) return true;
      const texto = normalizar(`${s.customerName} ${s.sellerName} ${s.number ?? ''} ${s.customerDocument}`);
      return termos.every(t => texto.includes(t));
    });
  });

  ngOnInit(): void {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    try {
      this.todos.set(await firstValueFrom(this.api.todos()));
    } catch (err) {
      this.erro.set(await apiMessageOrFallback(err, 'Não foi possível carregar os checklists.'));
    } finally {
      this.carregando.set(false);
    }
  }

  protected async abrir(s: ChecklistSummary): Promise<void> {
    this.acao.set(null);
    this.erro.set(null);
    this.abrindo.set(true);
    try {
      this.aberto.set(await firstValueFrom(this.api.detalhe(s.id)));
    } catch (err) {
      this.erro.set(await apiMessageOrFallback(err, 'Não foi possível abrir o checklist.'));
    } finally {
      this.abrindo.set(false);
    }
  }

  protected fechar(): void {
    this.aberto.set(null);
    this.acao.set(null);
  }

  protected escolher(acao: Acao): void {
    this.acao.set(acao);
    this.notas.set('');
    this.erro.set(null);
  }

  /** Devolver e negar exigem o motivo: é o que o vendedor vai ler. */
  protected precisaMotivo(acao: Acao | null): boolean {
    return acao === 'devolver' || acao === 'negar';
  }

  protected async confirmar(): Promise<void> {
    const d = this.aberto();
    const acao = this.acao();
    if (!d || !acao || this.processando()) return;
    const notas = this.notas().trim();
    if (this.precisaMotivo(acao) && !notas) return;
    this.processando.set(true);
    this.erro.set(null);
    try {
      const id = d.summary.id;
      const r = await firstValueFrom(
        acao === 'aprovar' ? this.api.aprovar(id, notas || null)
          : acao === 'devolver' ? this.api.devolver(id, notas)
          : acao === 'liberar' ? this.api.liberarAlteracao(id, notas || null)
          : this.api.negarAlteracao(id, notas));
      this.aberto.set(r);
      this.todos.update(lista => lista.map(x => (x.id === r.summary.id ? r.summary : x)));
      this.acao.set(null);
    } catch (err) {
      this.erro.set(await apiMessageOrFallback(err, 'Não foi possível concluir. Atualize a lista e tente de novo.'));
    } finally {
      this.processando.set(false);
    }
  }

  protected async pdf(id: string): Promise<void> {
    const aba = window.open('', '_blank');
    try {
      const blob = await firstValueFrom(this.api.pdf(id));
      const url = URL.createObjectURL(blob);
      if (aba) aba.location.href = url;
      else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      aba?.close();
      this.erro.set(await apiMessageOrFallback(err, 'Não foi possível gerar o comprovante.'));
    }
  }

  /** As mudanças de cada reenvio, agrupadas pela versão. */
  protected mudancasPorVersao(d: ChecklistDetail): { versao: number; itens: ChecklistDetail['changes'] }[] {
    const grupos = new Map<number, ChecklistDetail['changes']>();
    for (const c of d.changes) grupos.set(c.version, [...(grupos.get(c.version) ?? []), c]);
    return [...grupos.entries()].sort((a, b) => b[0] - a[0]).map(([versao, itens]) => ({ versao, itens }));
  }

  /** O selo da linha. Método tipado: no template do pk-table a linha chega como `any`. */
  protected st(s: ChecklistSummary): { label: string; tone: string } {
    return CHECKLIST_STATUS[s.status];
  }

  protected qtd(f: Filtro): number {
    return this.contagem()[f] ?? 0;
  }

  /** O checklist em pares rótulo/valor, na ordem da planilha — o que se lança no Sankhya. */
  protected secoes(c: ChecklistContent): { titulo: string; linhas: [string, string][] }[] {
    const sn = (v: boolean | null | undefined) => (v === null || v === undefined ? '—' : v ? 'Sim' : 'Não');
    const end = (a: ChecklistContent['mainAddress']) =>
      a ? [a.street, a.number, a.complement].filter(Boolean).join(', ') + ` — ${a.district ?? ''}, ${a.city ?? ''}/${a.state ?? ''} · CEP ${maskZip(a.zipCode)}` : '—';
    const tipo: Record<string, string> = { CAPO: 'Capô', ESTEIRA: 'Esteira', FRONTAL: 'Frontal', OUTRA: 'Outra' };
    const cu = c.customer;
    return [
      { titulo: 'Cliente e contrato', linhas: [
        ['Cliente', `${cu?.name ?? '—'}${cu?.newCustomer ? ' (cliente novo)' : cu?.code ? ` · código ${cu.code}` : ''}`],
        ['Razão social', cu?.legalName ?? '—'],
        ['CNPJ', formatarDocumento(cu?.document ?? '')],
        ['Inscrição estadual', cu?.stateRegistration ?? '—'],
        ['Telefone principal', mascararTelefone(cu?.mainPhone ?? '')],
        ['Celular', mascararTelefone(cu?.mobile ?? '')],
        ['Quem assina', `${cu?.signatory ?? '—'} · CPF ${formatarDocumento(cu?.signatoryCpf ?? '')}`],
        ['E-mail das notas', cu?.invoiceEmail ?? '—'],
        ['E-mail do contrato', cu?.contractEmail ?? '—'],
      ] },
      { titulo: 'Endereços', linhas: [
        ['Principal', end(c.mainAddress)],
        ['Entrega', c.deliverySameAsMain === false ? end(c.deliveryAddress) : 'O mesmo endereço'],
        ['Contato da unidade', [c.unitContact?.name, c.unitContact?.receivingHours, mascararTelefone(c.unitContact?.phone ?? '')].filter(Boolean).join(' · ') || '—'],
      ] },
      { titulo: 'Instalação', linhas: [
        ['Vai com a manutenção?', sn(c.installation?.withMaintenance)],
        ['Precisa de máquina?', sn(c.installation?.needsMachine)],
        ...(c.installation?.machines ?? []).map((m, i) => [
          `Máquina ${i + 1}`,
          `${m.quantity} × ${m.type === 'OUTRA' ? m.otherType : tipo[m.type ?? ''] ?? '—'}${m.withTable ? ' · com mesa' : ' · sem mesa'}`,
        ] as [string, string]),
        ...(c.installation?.notes ? [['Observação', c.installation.notes] as [string, string]] : []),
      ] },
      { titulo: 'Comodato', linhas: [
        ...(c.comodato?.items ?? []).map(i => [`${i.quantity} ×`, `${i.popularName ?? i.name} (${i.productCode})`] as [string, string]),
        ...(c.comodato?.extraItems ?? []).map(i => [`${i.quantity} ×`, `${i.description} (fora da lista)`] as [string, string]),
        ...(c.comodato?.notes ? [['Observações', c.comodato.notes] as [string, string]] : []),
      ] },
      { titulo: 'Comunicação visual', linhas: [
        ...(c.visual?.items ?? []).map(i => [`${i.quantity} ×`, i.name] as [string, string]),
        ...(c.visual?.products ?? []).map(p => [p.name, `etiqueta equip.: ${sn(p.equipmentLabel)} · frasco: ${sn(p.bottleLabel)} · diluição ${p.dilution ?? '—'}`] as [string, string]),
        ['Documentação técnica', c.visual?.technicalDocs ? `Sim · ${c.visual.technicalDocsEmail}` : sn(c.visual?.technicalDocs)],
      ] },
    ];
  }
}

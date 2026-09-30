import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ComodatoCandidate, RegisterComodatoItem, RegisterVisualItem } from '../../../../domain/models/sales/checklist.model';
import { apiMessageOrFallback } from '../../../../domain/utils/api-error';
import { normalizar } from '../../../../domain/utils/checklist/checklist-regras';
import { ChecklistApiService } from '../../../../infrastructure/services/sales/checklist-api.service';
import { PkCanDirective } from '../../../../infrastructure/directives/pk-can.directive';

type Aba = 'visual' | 'comodato';

/**
 * Os cadastros do checklist (`vendas/checklist-cadastros`), mantidos pela
 * Controladoria: os itens de comunicação visual e os equipamentos de comodato.
 *
 * Nada se apaga — item que sai é desativado, porque checklists antigos o citam.
 * O comodato é escolhido entre os produtos do Sankhya (grupos de comodato,
 * lavanderia e embalagem); aqui fica o nome do dia a dia, por onde o vendedor
 * procura, e a ordem.
 */
@Component({
  selector: 'app-checklist-cadastros',
  standalone: true,
  imports: [PkCanDirective],
  templateUrl: './checklist-cadastros.component.html',
  styleUrl: './checklist-cadastros.component.scss',
})
export class ChecklistCadastrosComponent implements OnInit {

  private readonly api = inject(ChecklistApiService);

  protected readonly aba = signal<Aba>('visual');
  protected readonly visuais = signal<RegisterVisualItem[]>([]);
  protected readonly comodatos = signal<RegisterComodatoItem[]>([]);
  protected readonly candidatos = signal<ComodatoCandidate[]>([]);
  protected readonly carregando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly ok = signal<string | null>(null);

  protected readonly novoVisual = signal('');
  protected readonly buscaCandidato = signal('');
  protected readonly adicionando = signal(false);

  protected readonly candidatosFiltrados = computed(() => {
    const termos = normalizar(this.buscaCandidato()).split(' ').filter(Boolean);
    return this.candidatos()
      .filter(c => !c.chosen)
      .filter(c => termos.every(t => normalizar(`${c.name} ${c.productCode}`).includes(t)))
      .slice(0, 30);
  });

  ngOnInit(): void {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const [v, c] = await Promise.all([firstValueFrom(this.api.itensVisuais()), firstValueFrom(this.api.itensComodato())]);
      this.visuais.set(v);
      this.comodatos.set(c);
    } catch (err) {
      this.erro.set(await apiMessageOrFallback(err, 'Não foi possível carregar os cadastros.'));
    } finally {
      this.carregando.set(false);
    }
  }

  // ── Comunicação visual ───────────────────────────────────────────────────

  protected async criarVisual(): Promise<void> {
    const nome = this.novoVisual().trim();
    if (!nome) return;
    const ordem = Math.max(0, ...this.visuais().map(v => v.sortOrder)) + 10;
    await this.salvar(async () => {
      const criado = await firstValueFrom(this.api.criarItemVisual({ name: nome, sortOrder: ordem, active: true }));
      this.visuais.update(l => [...l, criado]);
      this.novoVisual.set('');
      return `"${criado.name}" incluído.`;
    });
  }

  protected async salvarVisual(item: RegisterVisualItem, mudanca: Partial<RegisterVisualItem>): Promise<void> {
    const alvo = { ...item, ...mudanca };
    if (!alvo.name.trim()) return;
    await this.salvar(async () => {
      const salvo = await firstValueFrom(this.api.alterarItemVisual(item.id, { name: alvo.name.trim(), sortOrder: alvo.sortOrder, active: alvo.active }));
      this.visuais.update(l => l.map(v => (v.id === salvo.id ? salvo : v)).sort((a, b) => a.sortOrder - b.sortOrder));
      return `"${salvo.name}" salvo.`;
    });
  }

  // ── Comodato ─────────────────────────────────────────────────────────────

  protected async abrirAdicionar(): Promise<void> {
    this.adicionando.set(true);
    if (this.candidatos().length) return;
    try {
      this.candidatos.set(await firstValueFrom(this.api.candidatosComodato()));
    } catch (err) {
      this.erro.set(await apiMessageOrFallback(err, 'Não foi possível buscar os produtos no Sankhya.'));
    }
  }

  protected async adicionarComodato(c: ComodatoCandidate): Promise<void> {
    const ordem = Math.max(0, ...this.comodatos().map(x => x.sortOrder)) + 10;
    await this.salvar(async () => {
      const criado = await firstValueFrom(this.api.criarItemComodato({ productCode: c.productCode, popularName: null, sortOrder: ordem, active: true }));
      this.comodatos.update(l => [...l, criado]);
      this.candidatos.update(l => l.map(x => (x.productCode === c.productCode ? { ...x, chosen: true } : x)));
      return `"${c.name}" incluído. Escreva o nome popular, se quiser.`;
    });
  }

  protected async salvarComodato(item: RegisterComodatoItem, mudanca: Partial<RegisterComodatoItem>): Promise<void> {
    const alvo = { ...item, ...mudanca };
    await this.salvar(async () => {
      const salvo = await firstValueFrom(this.api.alterarItemComodato(item.id, {
        productCode: alvo.productCode, popularName: alvo.popularName?.trim() || null, sortOrder: alvo.sortOrder, active: alvo.active,
      }));
      this.comodatos.update(l => l.map(v => (v.id === salvo.id ? salvo : v)).sort((a, b) => a.sortOrder - b.sortOrder));
      return 'Salvo.';
    });
  }

  private async salvar(fazer: () => Promise<string>): Promise<void> {
    this.erro.set(null);
    this.ok.set(null);
    try {
      this.ok.set(await fazer());
    } catch (err) {
      this.erro.set(await apiMessageOrFallback(err, 'Não foi possível salvar.'));
    }
  }

  protected numero(texto: string): number {
    const n = Number(texto);
    return Number.isFinite(n) ? Math.round(n) : 0;
  }
}

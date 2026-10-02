import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { PayslipTypeStore } from '../../../infrastructure/state/payslip-type.store';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { animate, style, transition, trigger, query, stagger } from '@angular/animations';
import { PageHeaderComponent } from '../shared/page-header/page-header.component';
import { PkButtonComponent } from '../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import {
  Holerite,
  HoleriteTipo,
} from '../../../domain/models/hr/holerite.model';

type Filtro = 'TODOS' | HoleriteTipo;

interface GrupoAno {
  ano: string;
  itens: Holerite[];
}

@Component({
  selector: 'app-holerites',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, PkButtonComponent, PkDialogComponent],
  templateUrl: './holerites.component.html',
  styleUrl: './holerites.component.scss',
  animations: [
    trigger('listAnimation', [
      transition(':enter', [
        query('.hl-card', [
          style({ opacity: 0, transform: 'translateY(12px)' }),
          stagger(50, [
            animate('280ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ])
  ]
})
export class HoleritesComponent implements OnInit {
  holerites = signal<Holerite[]>([]);
  loading = signal(true);
  erro = signal(false);
  baixandoId = signal<string | null>(null);

  /**
   * O holerite esperando confirmação para ser baixado.
   *
   * O botão voluntário de confirmar não funcionava: ninguém clica em algo que
   * não precisa clicar, e a auditoria ficava vazia como se ninguém tivesse
   * recebido nada. Agora o recibo vem do ato que a pessoa já queria praticar —
   * ela quer o arquivo, e confirmar é o caminho até ele.
   */
  confirmando = signal<Holerite | null>(null);
  salvandoConfirmacao = signal(false);
  filtro = signal<Filtro>('TODOS');

  private readonly types = inject(PayslipTypeStore);

  /**
   * Só os tipos que a pessoa TEM, na ordem do cadastro: um botão "Férias
   * coletivas" para quem nunca recebeu um levaria a uma lista vazia. Tipo que
   * a pessoa tem e a lista não conhece ainda entra no fim, com o código.
   */
  readonly tipos = computed(() => {
    const meus = new Set(this.holerites().map(h => h.tipo));
    const doCadastro = this.types.views().filter(t => meus.has(t.code));
    const conhecidos = new Set(doCadastro.map(t => t.code));
    return [...doCadastro, ...[...meus].filter(c => !conhecidos.has(c)).map(c => this.types.viewOf(c))];
  });

  private readonly meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];

  filtrados = computed(() => {
    const f = this.filtro();
    const all = this.holerites();
    return f === 'TODOS' ? all : all.filter(h => h.tipo === f);
  });

  grupos = computed<GrupoAno[]>(() => {
    const map = new Map<string, Holerite[]>();
    for (const h of this.filtrados()) {
      const ano = h.competencia.slice(0, 4);
      const list = map.get(ano) ?? [];
      list.push(h);
      map.set(ano, list);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([ano, itens]) => ({ ano, itens }));
  });

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.types.load();
    this.http.get<Holerite[]>(`${environment.apiUrl}/holerite/me`).subscribe({
      next: (data) => {
        this.holerites.set(data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.erro.set(true);
        this.loading.set(false);
      },
    });
  }

  competenciaLabel(comp: string): string {
    const [ano, mes] = comp.split('-');
    const idx = parseInt(mes, 10) - 1;
    return `${this.meses[idx] ?? ''} de ${ano}`;
  }

  mesLabel(comp: string): string {
    const mes = parseInt(comp.split('-')[1], 10) - 1;
    return this.meses[mes] ?? '';
  }

  tipoLabel(tipo: HoleriteTipo): string {
    return this.types.labelOf(tipo);
  }

  setFiltro(f: Filtro): void {
    this.filtro.set(f);
  }

  /** Já confirmado baixa direto; o primeiro download passa pela confirmação. */
  abrir(h: Holerite): void {
    if (h.confirmedAt) {
      this.baixar(h);
      return;
    }
    this.confirmando.set(h);
  }

  fecharConfirmacao(): void {
    this.confirmando.set(null);
  }

  /** Confirma e baixa em seguida: para a pessoa é um clique só, com um aviso. */
  confirmarEBaixar(): void {
    const h = this.confirmando();
    if (!h || this.salvandoConfirmacao()) return;

    this.salvandoConfirmacao.set(true);

    this.http.post(`${environment.apiUrl}/holerite/${h.id}/confirmar`, null, { responseType: 'text' })
      .subscribe({
        next: () => {
          this.salvandoConfirmacao.set(false);
          this.confirmando.set(null);
          // Atualiza no lugar: recarregar a lista inteira por um clique é exagero.
          this.holerites.update(lista => lista.map(item =>
            item.id === h.id ? { ...item, confirmedAt: new Date().toISOString() } : item));
          this.baixar(h);
        },
        error: () => {
          this.salvandoConfirmacao.set(false);
          this.confirmando.set(null);
          // O recibo falhou, mas o holerite é dela: baixar não pode ser bloqueado
          // por causa da nossa auditoria.
          this.baixar(h);
        },
      });
  }

  baixar(h: Holerite): void {
    this.baixandoId.set(h.id);
    this.http
      .get(`${environment.apiUrl}/holerite/${h.id}/arquivo`, { responseType: 'blob' })
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `holerite-${h.competencia.slice(0, 7)}-${h.tipo.toLowerCase()}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
          this.baixandoId.set(null);
        },
        error: () => this.baixandoId.set(null),
      });
  }
}

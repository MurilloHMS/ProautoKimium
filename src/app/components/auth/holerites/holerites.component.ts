import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { animate, style, transition, trigger, query, stagger } from '@angular/animations';
import { PageHeaderComponent } from '../shared/page-header/page-header.component';
import {
  HOLERITE_TIPOS,
  HOLERITE_TIPO_LABEL,
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
  imports: [CommonModule, PageHeaderComponent],
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
  confirmandoId = signal<string | null>(null);
  filtro = signal<Filtro>('TODOS');

  /** Os mesmos tipos do envio, na mesma ordem — uma lista só para as duas telas. */
  readonly tipos = HOLERITE_TIPOS;

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
    return HOLERITE_TIPO_LABEL[tipo] ?? tipo;
  }

  setFiltro(f: Filtro): void {
    this.filtro.set(f);
  }

  /**
   * Confirmação de recebimento — só o dono pode, e a API recusa o resto.
   *
   * Abrir o arquivo já é registrado sozinho, mas abrir não é receber: quem
   * clica aqui está dizendo que viu e conferiu, e é isso que a auditoria do RH
   * mostra na coluna própria.
   */
  confirmar(h: Holerite, event: Event): void {
    event.stopPropagation();   // o cartão inteiro é o botão de baixar
    if (h.confirmedAt || this.confirmandoId()) return;

    this.confirmandoId.set(h.id);

    this.http.post(`${environment.apiUrl}/holerite/${h.id}/confirmar`, null, { responseType: 'text' })
      .subscribe({
        next: () => {
          this.confirmandoId.set(null);
          // Atualiza a lista local: recarregar tudo por um clique seria exagero.
          this.holerites.update(lista => lista.map(item =>
            item.id === h.id ? { ...item, confirmedAt: new Date().toISOString() } : item));
        },
        error: () => this.confirmandoId.set(null),
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

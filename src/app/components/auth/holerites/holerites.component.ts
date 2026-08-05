import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { animate, style, transition, trigger, query, stagger } from '@angular/animations';
import { PageHeaderComponent } from '../shared/page-header/page-header.component';

type HoleriteTipo = 'ADIANTAMENTO' | 'SALARIO';
type Filtro = 'TODOS' | HoleriteTipo;

interface Holerite {
  id: string;
  competencia: string;
  tipo: HoleriteTipo;
  originalFilename: string;
  createdAt: string;
}

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
  filtro = signal<Filtro>('TODOS');

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
    return tipo === 'ADIANTAMENTO' ? 'Adiantamento' : 'Salário';
  }

  setFiltro(f: Filtro): void {
    this.filtro.set(f);
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

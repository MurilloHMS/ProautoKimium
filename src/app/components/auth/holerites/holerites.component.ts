import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface Holerite {
  id: string;
  competencia: string;      // "2026-06-01"
  originalFilename: string;
  createdAt: string;
}

@Component({
  selector: 'app-holerites',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './holerites.component.html',
  styleUrl: './holerites.component.scss',
})
export class HoleritesComponent implements OnInit {
  holerites = signal<Holerite[]>([]);
  loading = signal(true);
  erro = signal(false);
  baixandoId = signal<string | null>(null);

  private readonly meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];

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

  baixar(h: Holerite): void {
    this.baixandoId.set(h.id);
    this.http
      .get(`${environment.apiUrl}/holerite/${h.id}/arquivo`, { responseType: 'blob' })
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `holerite-${h.competencia.slice(0, 7)}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
          this.baixandoId.set(null);
        },
        error: () => this.baixandoId.set(null),
      });
  }
}

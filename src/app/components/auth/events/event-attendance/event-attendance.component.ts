import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';

import { Attendance, Attendee } from '../../../../domain/models/events.model';
import { formatDeadline, formatPeriod, formatStamp, hhmm } from '../../../../domain/utils/events';
import { EventsService } from '../../../../infrastructure/services/events/events.service';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkComboboxComponent } from '../../../theme/ProautoKimium/pk-combobox/pk-combobox.component';
import { PkKpiComponent } from '../../../theme/ProautoKimium/pk-kpi/pk-kpi.component';
import { PkSegmentedComponent } from '../../../theme/ProautoKimium/pk-segmented/pk-segmented.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';

export type FiltroPresenca = 'todos' | 'vao' | 'nao-vao' | 'sem-resposta' | 'nem-abriram';

/**
 * Acompanhamento de um evento: quem viu, quem respondeu, o que escreveu e
 * quando o lembrete saiu. É a auditoria que o pedido trouxe — leitura pura.
 *
 * Os totais contam quem está no público hoje. Quem respondeu e depois saiu do
 * público continua na lista, marcado, e fica fora dos números: a auditoria não
 * apaga o que a pessoa fez.
 */
@Component({
  selector: 'app-event-attendance',
  standalone: true,
  imports: [
    FormsModule, PkButtonComponent, PkComboboxComponent, PkKpiComponent, PkSegmentedComponent,
    PageHeaderComponent, ToolbarComponent,
  ],
  templateUrl: './event-attendance.component.html',
  styleUrl: './event-attendance.component.scss',
})
export class EventAttendanceComponent {
  private readonly service = inject(EventsService);

  readonly eventId = input.required<string>();
  readonly celular = input(false);
  readonly back = output<void>();

  readonly dados = signal<Attendance | null>(null);
  readonly carregando = signal(true);
  readonly erro = signal(false);
  readonly filtro = signal<FiltroPresenca>('todos');
  readonly busca = signal('');

  readonly formatPeriod = formatPeriod;
  readonly formatStamp = formatStamp;
  readonly formatDeadline = formatDeadline;

  readonly filtros = computed(() => {
    const d = this.dados();
    return [
      { valor: 'todos' as const, rotulo: 'Todos', total: d?.invited ?? 0 },
      { valor: 'vao' as const, rotulo: 'Vão', total: d?.going ?? 0 },
      { valor: 'nao-vao' as const, rotulo: 'Não vão', total: d?.notGoing ?? 0 },
      { valor: 'sem-resposta' as const, rotulo: 'Sem resposta', total: d?.noAnswer ?? 0 },
      { valor: 'nem-abriram' as const, rotulo: 'Nem abriram', total: d?.neverViewed ?? 0 },
    ];
  });

  /** As opções do filtro com a contagem no rótulo: "Sem resposta · 46". */
  readonly opcoesFiltro = computed(() => this.filtros().map(f => ({ label: `${f.rotulo} · ${f.total}`, value: f.valor })));

  readonly linhas = computed(() => {
    const d = this.dados();
    if (!d) return [];
    const q = this.busca().trim().toLowerCase();
    const filtro = this.filtro();
    return d.attendees
      .filter(a => filtro === 'todos' || (a.invited && this.passa(a, filtro)))
      .filter(a => !q || [a.name, a.companyName, a.departmentName].some(v => v?.toLowerCase().includes(q)));
  });

  /** "lembrete todo dia às 09:00 (enviado 29/09, 30/09 e 01/10)". */
  readonly resumoLembrete = computed(() => {
    const d = this.dados();
    if (!d) return '';
    const dias = d.reminderDays.map(r => formatStamp(r.day + 'T00:00').slice(0, 5));
    const enviados = dias.length
      ? ` (enviado ${dias.length === 1 ? dias[0] : dias.slice(0, -1).join(', ') + ' e ' + dias[dias.length - 1]})`
      : '';
    if (!d.reminderEnabled) return dias.length ? `lembrete desligado${enviados}` : 'sem lembrete';
    const desde = d.reminderDaysBefore ? `, a partir de ${d.reminderDaysBefore} ${d.reminderDaysBefore === 1 ? 'dia' : 'dias'} antes` : '';
    return `lembrete todo dia às ${hhmm(d.reminderTime)}${desde}${enviados}`;
  });

  constructor() {
    effect(() => {
      const id = this.eventId();
      untracked(() => this.carregar(id));
    });
  }

  carregar(id = this.eventId()): void {
    this.carregando.set(true);
    this.erro.set(false);
    this.service.attendance(id).subscribe({
      next: d => {
        this.dados.set(d);
        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set(true);
      },
    });
  }

  private passa(a: Attendee, filtro: FiltroPresenca): boolean {
    switch (filtro) {
      case 'vao': return a.answer === 'GOING';
      case 'nao-vao': return a.answer === 'NOT_GOING';
      case 'sem-resposta': return !a.answer;
      case 'nem-abriram': return a.viewCount === 0;
      default: return true;
    }
  }

  ondeTrabalha(a: Attendee): string {
    return [a.companyName, a.departmentName].filter(Boolean).join(' · ') || '—';
  }

  vezes(n: number): string {
    return n === 1 ? '1 vez' : `${n} vezes`;
  }

  rotuloResposta(a: Attendee): string {
    return a.answer === 'GOING' ? 'Vai' : a.answer === 'NOT_GOING' ? 'Não vai' : 'Sem resposta';
  }

  /** Uma planilha com tudo o que a tela mostra, mais a aba dos lembretes. */
  exportar(): void {
    const d = this.dados();
    if (!d) return;
    const pessoas = d.attendees.map(a => ({
      'Funcionário': a.name,
      'Empresa': a.companyName ?? '',
      'Setor': a.departmentName ?? '',
      'No público': a.invited ? 'Sim' : 'Não (saiu depois)',
      'Visualizou pela primeira vez': a.firstViewedAt ? formatStampFull(a.firstViewedAt) : '',
      'Visualizou pela última vez': a.lastViewedAt ? formatStampFull(a.lastViewedAt) : '',
      'Visualizações': a.viewCount,
      'Resposta': this.rotuloResposta(a),
      'Respondeu pela primeira vez': a.firstAnsweredAt ? formatStampFull(a.firstAnsweredAt) : '',
      'Última alteração da resposta': a.answeredAt ? formatStampFull(a.answeredAt) : '',
      'Observação': a.note ?? '',
    }));
    const lembretes = d.reminderDays.map(r => ({
      'Dia': formatStampFull(r.day + 'T00:00').slice(0, 10),
      'Enviado às': formatStampFull(r.sentAt),
      'Pessoas lembradas': r.recipients,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pessoas), 'Convidados');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lembretes.length ? lembretes : [{ 'Dia': 'Nenhum lembrete enviado' }]), 'Lembretes');
    XLSX.writeFile(wb, `acompanhamento_${slug(d.eventName)}.xlsx`);
  }
}

/** "01/10/2026 09:00" — na planilha o ano importa: ela sai da tela e vai para o arquivo. */
export function formatStampFull(iso: string): string {
  const [data, hora] = iso.split('T');
  const [y, m, dd] = data.split('-');
  return `${dd}/${m}/${y} ${hhmm(hora)}`;
}

function slug(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase() || 'evento';
}

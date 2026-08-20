import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

import {
  AUDITORIA_SITUACAO_INFO,
  HOLERITE_TIPOS,
  HoleriteAuditoria,
  HoleriteTipo,
  situacaoDe,
} from '../../../../domain/models/hr/holerite.model';
import { HoleriteService } from '../../../../infrastructure/services/hr/holerite.service';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkEmptyComponent } from '../../../theme/ProautoKimium/pk-empty/pk-empty.component';

/**
 * Auditoria dos holerites de uma competência: quem recebeu, quem abriu e quem
 * confirmou — e as duas correções possíveis.
 *
 * Cancelar não apaga: o registro fica aqui e some da tela do funcionário.
 * Substituir troca o PDF e zera as duas datas, porque o recibo era do arquivo
 * anterior.
 */
@Component({
  selector: 'app-holerite-auditoria',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmDialogModule,
            PkButtonComponent, PkDialogComponent, PkEmptyComponent],
  templateUrl: './holerite-auditoria.component.html',
  styleUrl: './holerite-auditoria.component.scss',
  providers: [ConfirmationService],
})
export class HoleriteAuditoriaComponent {

  private readonly service = inject(HoleriteService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  readonly competencia = signal(mesAtual());
  readonly tipo = signal<HoleriteTipo>('SALARIO');
  readonly itens = signal<HoleriteAuditoria[]>([]);
  readonly carregando = signal(false);
  readonly buscou = signal(false);

  readonly tipos = HOLERITE_TIPOS;
  readonly situacaoInfo = AUDITORIA_SITUACAO_INFO;
  readonly situacaoDe = situacaoDe;

  /** Substituição em andamento, por linha: o input de arquivo é um por linha. */
  readonly substituindoId = signal<string | null>(null);

  /** Cancelamento pede motivo, e motivo é campo — não `prompt` do navegador. */
  readonly cancelando = signal<HoleriteAuditoria | null>(null);
  readonly cancelandoSalvando = signal(false);
  motivo = '';

  readonly resumo = computed(() => {
    const itens = this.itens();
    const ativos = itens.filter(i => !i.canceledAt);

    return {
      total: itens.length,
      confirmados: ativos.filter(i => i.confirmedAt).length,
      abertos: ativos.filter(i => i.openedAt && !i.confirmedAt).length,
      naoAbertos: ativos.filter(i => !i.openedAt).length,
      cancelados: itens.length - ativos.length,
    };
  });

  buscar(): void {
    if (!this.competencia() || this.carregando()) return;

    this.carregando.set(true);

    this.service.auditoria(this.competencia(), this.tipo()).subscribe({
      next: (itens) => {
        this.itens.set(itens ?? []);
        this.carregando.set(false);
        this.buscou.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.carregando.set(false);
        this.buscou.set(true);
        this.itens.set([]);
        this.erro(err, 'Não foi possível carregar a auditoria.');
      },
    });
  }

  baixar(item: HoleriteAuditoria): void {
    this.service.baixar(item.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${item.codParceiro}-${item.competencia}-${item.tipo.toLowerCase()}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (err: HttpErrorResponse) => this.erro(err, 'Não foi possível baixar o arquivo.'),
    });
  }

  cancelar(item: HoleriteAuditoria): void {
    this.motivo = '';
    this.cancelando.set(item);
  }

  fecharCancelamento(): void {
    this.cancelando.set(null);
  }

  confirmarCancelamento(): void {
    const item = this.cancelando();
    if (!item || !this.motivo.trim() || this.cancelandoSalvando()) return;

    this.cancelandoSalvando.set(true);

    this.service.cancelar(item.id, this.motivo.trim()).subscribe({
      next: () => {
        this.cancelandoSalvando.set(false);
        this.cancelando.set(null);
        this.messageService.add({ severity: 'success', summary: 'Cancelado', detail: item.employeeNome });
        this.buscar();
      },
      error: (err: HttpErrorResponse) => {
        this.cancelandoSalvando.set(false);
        this.erro(err, 'Não foi possível cancelar.');
      },
    });
  }

  onArquivoSubstituto(item: HoleriteAuditoria, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';   // permite escolher o mesmo arquivo de novo depois de um erro
    if (!file) return;

    this.confirmationService.confirm({
      header: 'Substituir arquivo',
      message: `Trocar o PDF de <strong>${item.employeeNome}</strong> por <strong>${file.name}</strong>?<br>`
        + 'O registro de visualização é zerado: o recibo atual era do arquivo anterior.',
      icon: 'pi pi-refresh',
      acceptLabel: 'Substituir',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-sm',
      rejectButtonStyleClass: 'p-button-outlined p-button-sm',
      accept: () => this.executarSubstituicao(item, file),
    });
  }

  private executarSubstituicao(item: HoleriteAuditoria, file: File): void {
    this.substituindoId.set(item.id);

    this.service.substituirArquivo(item.id, file).subscribe({
      next: () => {
        this.substituindoId.set(null);
        this.messageService.add({ severity: 'success', summary: 'Arquivo substituído', detail: item.employeeNome });
        this.buscar();
      },
      error: (err: HttpErrorResponse) => {
        this.substituindoId.set(null);
        this.erro(err, 'Não foi possível substituir o arquivo.');
      },
    });
  }

  private erro(err: HttpErrorResponse, padrao: string): void {
    const mensagem = err.status === 403
      ? 'Você não tem permissão para esta ação.'
      : typeof err.error === 'string' && err.error ? err.error : padrao;

    this.messageService.add({ severity: 'error', summary: 'Erro', detail: mensagem, life: 6000 });
  }
}

/** A competência que o RH quer ver ao abrir a tela é quase sempre a atual. */
function mesAtual(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${`${hoje.getMonth() + 1}`.padStart(2, '0')}`;
}

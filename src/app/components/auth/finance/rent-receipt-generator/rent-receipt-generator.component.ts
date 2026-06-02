import {Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, ViewChild} from '@angular/core';
import { CardModule} from "primeng/card";
import {CommonModule} from "@angular/common";
import {ButtonModule} from "primeng/button";
import {FileUpload, FileUploadModule} from "primeng/fileupload";
import {ProgressSpinnerModule} from "primeng/progressspinner";
import {TableModule} from "primeng/table";
import {TagModule} from "primeng/tag";
import {ToolbarModule} from "primeng/toolbar";
import {DividerModule} from "primeng/divider";
import {BadgeModule} from "primeng/badge";
import {ToggleSwitchModule} from "primeng/toggleswitch";
import {FormsModule} from "@angular/forms";
import {ToastModule} from "primeng/toast";
import {ConfirmDialogModule} from "primeng/confirmdialog";
import {ConfirmationService, MessageService} from "primeng/api";
import {SelectModule} from "primeng/select";
import {FloatLabel} from "primeng/floatlabel";
import {MatrizPreviewDTO} from "../../../../domain/models/rentReceipt.model";
import {DatePickerModule} from "primeng/datepicker";
import {RentReceiptService} from "../../../../infrastructure/services/rentReceiptService/rent-receipt.service";
import {Router} from "@angular/router";

@Component({
  selector: 'app-rent-receipt-generator',
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    FileUploadModule,
    ToastModule,
    ProgressSpinnerModule,
    TableModule,
    TagModule,
    ConfirmDialogModule,
    ToolbarModule,
    DividerModule,
    BadgeModule,
    ToggleSwitchModule,
    FormsModule,
    SelectModule,
    FloatLabel,
    DatePickerModule
  ],
  templateUrl: './rent-receipt-generator.component.html',
  styleUrl: './rent-receipt-generator.component.scss',
  providers: [MessageService, ConfirmationService],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class RentReceiptGeneratorComponent implements OnInit {
  @ViewChild('upload') upload!: FileUpload;

  processing = false;
  loading = false;
  selectedMonth: string = '';
  matrizes: MatrizPreviewDTO[] = [];
  processId = '';

  meses: string[] = [];

  constructor(private service: RentReceiptService,
              private messageService: MessageService,
              private confirmationService: ConfirmationService) {
  }

  ngOnInit(): void {
    this.meses = [
      'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
      'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
    ];
  }

  onUpload(event: any): void {
    const file = event.files[0];
    this.processing = true;
    this.loading = true;

    if(file != null){
      this.service.uploadFile(file)
        .subscribe({
          next: response => {
            this.processId = response.processId;

            this.matrizes = response.matrizes.map(m => ({
              ...m,
              dataVencimento: null
            }));

            this.processing = false;
            this.loading = false;
          },
          error: () => {
            this.processing = false;
            this.loading = false;
            this.messageService.add({
              severity: 'error',
              summary: 'Erro',
              detail: 'Ocorreu um erro ao enviar a planilha.'
            });
          }
        });
    }
  }

  gerarRecibos(): void {

    if (!this.selectedMonth) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Mês obrigatório',
        detail: 'Selecione o mês de referência antes de gerar os recibos.'
      });

      return;
    }

    const vencimentos: Record<string, string> = {};

    this.matrizes.forEach(m => {
      if (m.dataVencimento) {
        vencimentos[m.codMatriz] = this.formatarData(m.dataVencimento);
      }
    });

    const request = {
      processId: this.processId,
      mesReferencia: this.selectedMonth,
      vencimentos
    };

    this.loading = true;

    this.service.generateReceipts(request)
      .subscribe({
        next: (blob: Blob) => {

          const url = window.URL.createObjectURL(blob);

          const a = document.createElement('a');
          a.href = url;
          a.download = `recibos-${this.selectedMonth}.zip`;

          document.body.appendChild(a);
          a.click();

          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);

          this.loading = false;

          this.messageService.add({
            severity: 'success',
            summary: 'Sucesso',
            detail: 'Recibos gerados com sucesso.'
          });
        },
        error: () => {
          this.loading = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Erro',
            detail: 'Ocorreu um erro ao gerar os recibos.'
          });
        }
      });
  }

  apagarDatas(): void {

    this.confirmationService.confirm({
      header: 'Apagar Datas',
      message: 'Tem certeza que deseja apagar todas as datas preenchidas? Esta ação não poderá ser desfeita.',
      icon: 'pi pi-exclamation-triangle',

      acceptLabel: 'Sim',
      rejectLabel: 'Não',

      accept: () => {

        this.matrizes.forEach(m => {
          m.dataVencimento = null;
        });

        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: 'Datas apagadas com sucesso.'
        });
      }
    });
  }

  private formatarData(data: Date): string {
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();

    return `${dia}/${mes}/${ano}`;
  }

}

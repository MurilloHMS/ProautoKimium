import { Component } from '@angular/core';

import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { InputTextModule } from 'primeng/inputtext';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast'
import { environment } from '../../../environments/environment';
import { FloatLabelModule } from 'primeng/floatlabel';
import { Select } from "primeng/select";
import { Contact, TipoContato } from '../../domain/models/contact.model';
import { ContactService } from '../../infrastructure/services/contact/contact.service';



@Component({
    selector: 'app-contact',
    imports: [ReactiveFormsModule, InputTextModule, AutoCompleteModule, ButtonModule, ProgressSpinnerModule, ToastModule, FloatLabelModule, Select],
    templateUrl: './contact.component.html',
    styleUrl: './contact.component.scss',
    providers: [MessageService]
})
export class ContactComponent {
  form: FormGroup;
  isLoading = false;
  tipoSelecionado: TipoContato | null = null;
  tiposContato: TipoContato[] =[
    { label: 'Dúvida sobre produtos', value: "DuvidaProduto" },
    { label: 'Suporte técnico', value: "SuporteTecnico" },
    { label: 'Solicitação de orçamento', value: "SolicitacaoOrcamento" },
    { label: 'Representação comercial', value: "RepresentacaoComercial" },
    { label: 'Trabalhe conosco', value: "TrabalheConosco" },
    { label: 'Consultoria especializada', value: "ConsultoriaEspecializada" },
    { label: 'Agendar visita técnica', value: "VisitaTecnica" },
    { label: 'Informações sobre certificações', value: "InformacoesCertificacoes" },
    { label: 'Problemas com pedido ou entrega', value: "ProblemaPedidoEntrega" },
    { label: 'Outros', value: "Outros" }
  ];

  constructor(private fb: FormBuilder,
    private http: HttpClient,
    private messageService: MessageService,
    private contactService: ContactService
  ){
    this.form = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      businessName: ['', Validators.required],
      contactType: [null, Validators.required],
      other: [''],
      message: ['', Validators.required]
    });

    this.form.get('contactType')?.valueChanges.subscribe((tipo: TipoContato) => {
      const outroControl = this.form.get('other');
      if (tipo?.value === "Outros") {
        outroControl?.setValidators([Validators.required]);
      } else {
        outroControl?.clearValidators();
      }
      outroControl?.updateValueAndValidity();
    });
  }

  submit() {
    if (this.form.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atenção',
        detail: 'Existem campos obrigatórios não preenchidos'
      });
      return;
    }

    const contato: Contact = this.form.value;
    contato.name = this.form.value.name?.trim();
    contato.email = this.form.value.email?.trim();
    contato.message = this.form.value.message?.trim();
    contato.businessName = this.form.value.businessName?.trim();
    contato.other = this.form.value.other?.trim() || '';
    contato.contactType = this.form.value.contactType?.value;
    contato.contactDate = this.formatLocalDateTime(new Date());
    contato.contactStatus = "NaoContatado";

    this.isLoading = true;
    this.contactService.addContact(contato).subscribe({
      next: () => {
        this.isLoading = false;
        this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Contato enviado com sucesso!' });
        this.form.reset();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Erro ao enviar contato:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Ocorreu um erro ao entrar em contato, por favor utilize os dados ao lado.'
        });
      }
    });
  }


  private formatLocalDateTime(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
  }
}

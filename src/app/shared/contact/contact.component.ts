import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast'
import { environment } from '../../../environments/environment';
import { FloatLabelModule } from 'primeng/floatlabel';

interface TipoContato{
  label: string;
  value: number;
}

@Component({
    selector: 'app-contact',
    imports: [CommonModule, ReactiveFormsModule,
        // TODO: `HttpClientModule` should not be imported into a component directly.
        // Please refactor the code to add `provideHttpClient()` call to the provider list in the
        // application bootstrap logic and remove the `HttpClientModule` import from this component.
        HttpClientModule, InputTextModule,
        InputTextareaModule, DropdownModule, ButtonModule, ProgressSpinnerModule,
        ToastModule, FloatLabelModule
    ],
    templateUrl: './contact.component.html',
    styleUrl: './contact.component.scss',
    providers: [MessageService]
})
export class ContactComponent {
  form: FormGroup;
  isLoading = false;
  tiposContato: TipoContato[] =[
    { label: 'Dúvida sobre produtos', value: 0 },
    { label: 'Suporte técnico', value: 1 },
    { label: 'Solicitação de orçamento', value: 2 },
    { label: 'Representação comercial', value: 3 },
    { label: 'Trabalhe conosco', value: 4 },
    { label: 'Consultoria especializada', value: 5 },
    { label: 'Agendar visita técnica', value: 6 },
    { label: 'Informações sobre certificações', value: 7 },
    { label: 'Problemas com pedido ou entrega', value: 8 },
    { label: 'Outros', value: 9 }
  ];

  constructor(private fb: FormBuilder,
    private http: HttpClient, 
    private messageService: MessageService
  ){
    this.form = this.fb.group({
      nome: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      nomeEmpresa: ['', Validators.required],
      tipoContato: ['', Validators.required],
      outro: [''],
      mensagem: ['', Validators.required]
    });
  }

  submit(){
    if(this.form.invalid){
      this.messageService.add({severity: 'warn', summary: 'Atenção', detail: 'Existem campos obrigatórios não preenchidos'});
      return;
    }

    const contato = {
      ...this.form.value,
      statusContato: 0,
      dataSolicitadoContato: new Date().toISOString()
    };

    this.isLoading = true;
    this.http.post(`${environment.apiUrl}/contato`, contato, {responseType: 'text' }).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.messageService.add({severity: 'success', summary: 'Sucesso', detail: res});
        this.form.reset();
      },
      error: (err) =>{
        this.isLoading = false;
        this.messageService.add({severity: 'error', summary: 'Error', detail: 'Ocorreu um erro ao entrar em contato, por favor utilize os dados ao lado.'})
      }
    });
  }
}

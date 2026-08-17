import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToolbarModule } from 'primeng/toolbar';
import { ClientUser, Customer } from '../../../../domain/models/customer.model';
import { CustomerService } from '../../../../infrastructure/services/partners/customer/customer.service';
import { CustomerStore } from '../../../../infrastructure/state/customer.store';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import {PkButtonComponent} from "../../../theme/ProautoKimium/pk-button/pk-button.component";
import {PkTableComponent} from "../../../theme/ProautoKimium/pk-table/pk-table.component";
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import { FormScreenComponent } from '../../shared/form-screen/form-screen.component';
import { TabDirtyCheck } from '../../../../infrastructure/routing/tab-dirty-check';
import {PkInputComponent} from "../../../theme/ProautoKimium/pk-input/pk-input.component";
import {PkCheckboxComponent} from "../../../theme/ProautoKimium/pk-checkbox/pk-checkbox.component";
import {PkFileUploadComponent} from "../../../theme/ProautoKimium/pk-file-upload/pk-file-upload.component";

@Component({
    selector: 'app-customer',
  imports: [TableModule, CommonModule, ButtonModule, ToolbarModule, ToastModule,
    DialogModule, InputTextModule, ReactiveFormsModule, CheckboxModule, PkButtonComponent, PkTableComponent, ToolbarComponent, FormScreenComponent, PkInputComponent, PkCheckboxComponent, PkCheckboxComponent, PkFileUploadComponent],
    templateUrl: './customer.component.html',
    styleUrl: './customer.component.scss',
    providers: [MessageService]
})
export class CustomerComponent implements OnInit, TabDirtyCheck {

  /** grade ou formulário: fechar a aba no meio do cadastro pede confirmação. */
  isTabDirty(): boolean {
    return this.mode() === 'form' && this.form.dirty;
  }

  closeForm(): void {
    this.mode.set('grid');
  }

  /**
   * A lista vem do store: a tela nao guarda copia, e quem precisar de um
   * combo de cliente le daqui.
   */
  private readonly customerStore = inject(CustomerStore);
  readonly customers = this.customerStore.items;
  readonly loading = this.customerStore.loading;
  /**
   * Grade, formulário ou acessos — o cadastro de cliente não usa mais diálogo.
   * "Acessos" é quem entra no portal por este cliente.
   */
  readonly mode = signal<'grid' | 'form' | 'access'>('grid');

  // ─── Acessos ao portal ────────────────────────────────────────────────────

  private readonly customerService = inject(CustomerService);

  readonly accessCustomer = signal<Customer | null>(null);
  readonly accessUsers = signal<ClientUser[]>([]);
  readonly accessLoading = signal(false);
  readonly accessSaving = signal(false);

  /**
   * Formulário do convite: um campo só. Quem define a senha é a pessoa
   * convidada, na tela do portal — aqui ninguém escolhe senha de ninguém.
   *
   * Montado no construtor, e não como inicializador de campo: o campo seria
   * avaliado antes de o construtor atribuir o FormBuilder, e a chamada
   * estouraria em tempo de execução.
   */
  inviteForm: FormGroup;

  openAccess(customer: Customer): void {
    this.accessCustomer.set(customer);
    this.accessUsers.set([]);
    this.inviteForm.reset();
    this.mode.set('access');
    this.loadAccess();
  }

  loadAccess(): void {
    const customer = this.accessCustomer();
    if (!customer) return;

    this.accessLoading.set(true);

    this.customerService.getAccess(customer.codParceiro).subscribe({
      next: users => {
        this.accessUsers.set(users ?? []);
        this.accessLoading.set(false);
      },
      error: () => {
        this.accessUsers.set([]);
        this.accessLoading.set(false);
        this.toast('error', 'Não foi possível carregar os acessos');
      },
    });
  }

  /** Uma chamada: a API cria o convite e envia o link. O usuário nasce depois. */
  invite(): void {
    const customer = this.accessCustomer();
    if (!customer || this.inviteForm.invalid || this.accessSaving()) return;

    const email = String(this.inviteForm.value.email).trim();

    this.accessSaving.set(true);

    this.customerService.invite(customer.codParceiro, email).subscribe({
      next: () => {
        this.accessSaving.set(false);
        this.inviteForm.reset();
        this.toast('success', `Convite enviado para ${email}`);
        this.loadAccess();
      },
      error: err => {
        this.accessSaving.set(false);
        this.toast('error', this.inviteErrorFor(err, email));
      },
    });
  }

  /**
   * O status HTTP diz o que houve — desde que a API pare de responder 500 para
   * regra recusada, cada caso vira uma frase que a pessoa consegue agir sobre.
   */
  private inviteErrorFor(err: { status?: number; error?: unknown }, email: string): string {
    if (err?.status === 409) return `${email} já tem acesso ou um convite em aberto.`;
    if (err?.status === 403) return 'Cliente inativo não recebe acesso ao portal.';
    if (err?.status === 404) return 'Cliente não encontrado.';
    return typeof err?.error === 'string' && err.error
      ? err.error
      : 'Não foi possível enviar o convite';
  }

  removeAccess(user: ClientUser): void {
    // Convite pendente não tem usuário para desvincular — ele vence sozinho em
    // 48 horas. Remover teria de apagar o token, e isso a API ainda não faz.
    if (user.pending || !user.login) {
      this.toast('info', 'Convite pendente expira sozinho em 48 horas.');
      return;
    }

    if (!confirm(`Remover o acesso de ${user.login} ao portal?`)) return;

    this.customerService.unlinkUser(user.login).subscribe({
      next: () => {
        this.toast('success', 'Acesso removido');
        this.loadAccess();
      },
      error: () => this.toast('error', 'Não foi possível remover o acesso'),
    });
  }

  closeAccess(): void {
    this.accessCustomer.set(null);
    this.mode.set('grid');
  }

  private toast(severity: 'success' | 'error' | 'info', detail: string): void {
    this.messageService.add({
      severity,
      summary: { success: 'Pronto', error: 'Erro', info: 'Aviso' }[severity],
      detail,
    });
  }
  customer: Customer | null = null;
  form: FormGroup;
  dialogTitle: string = 'Adicionar Cliente';
  customerToEdit: Customer | null = null;
  isUploading: boolean = false;
  selectedFile: File | null = null;

  constructor(
    private messageService: MessageService,
    private fb: FormBuilder){
    this.form = this.fb.group({
      codParceiro: ['', Validators.required],
      documento: ['', Validators.required],
      nome: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      ativo: [true, Validators.required],
      recebeEmail: [true, Validators.required],
      codMatriz: [''],
      isMatriz: [false]
    });

    this.inviteForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  ngOnInit(): void {
    this.customerStore.load();
  }

  loadCustomers(){
    this.customerStore.refresh();
  }

  editCustomer(customer: Customer) {
    this.dialogTitle = 'Editar Cliente';
    this.customerToEdit = customer;

    this.form.patchValue({
      codParceiro: customer.codParceiro,
      documento: customer.documento,
      nome: customer.nome,
      email: customer.email,
      ativo: customer.ativo,
      recebeEmail: customer.recebeEmail,
      codMatriz: customer.codMatriz ?? null,
      isMatriz: customer.isMatriz ?? false
    });
    this.mode.set('form');
  }

  deleteCustomer(customer: Customer) {
    //Todo criar metodo para deletar cliente
  }
  showDialog() {
    this.dialogTitle = 'Adicionar Cliente';
    this.customerToEdit = null;
    this.form.reset({
      ativo: true,
      recebeEmail: true,
      isMatriz: false
    });
    this.mode.set('form');
  }

  saveCustomer(){
    if(this.form.valid){
      const customer: Customer = this.form.value;

      if(this.customerToEdit){
        this.customerStore.update(customer).subscribe({
          next: () => {
            this.mode.set('grid');
          },
          error: (err) => alert('Erro ao atualizar cliente: ' + err.message)
        });
      } else{
        this.customerStore.create(customer).subscribe({
          next: () =>{
            this.mode.set('grid');
          },
          error: (err) => alert('Erro ao adicionar cliente: ' + err.message)
        });
      }
    };
  }

  importByExcel() {
    if (!this.selectedFile) return;

    this.isUploading = true;

    // A planilha entra e a lista se recarrega sozinha: antes o cliente
    // importado só aparecia depois de clicar em Atualizar.
    this.customerStore.importByExcel(this.selectedFile).subscribe({
      next: (msg) => {
        this.isUploading = false;
        // Sem limpar, o botão continua na tela e convida a mandar de novo.
        this.selectedFile = null;
        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: String(msg)
        });
      },
      error: (err) => {
        this.isUploading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: err.error || err.message || 'Erro desconhecido'
        });
      }
    });
  }


  /**
   * Escolher a planilha já envia — não há passo intermediário.
   *
   * `pk-fileUpload` emite `File[]`; o `p-fileUpload` do PrimeNG emitia
   * `{ files }`, e o handler antigo lia o campo errado.
   */
  onFileSelect(files: File[]) {
    this.selectedFile = files?.[0] ?? null;
    if (this.selectedFile) this.importByExcel();
  }

}


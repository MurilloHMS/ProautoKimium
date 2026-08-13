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
import { AuthService } from '../../../../infrastructure/services/auth.service';
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
  private readonly authService = inject(AuthService);

  readonly accessCustomer = signal<Customer | null>(null);
  readonly accessUsers = signal<ClientUser[]>([]);
  readonly accessLoading = signal(false);
  readonly accessSaving = signal(false);

  /**
   * Formulário do convite. A senha é provisória: ver o aviso na tela.
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

  /**
   * Cria o usuário e vincula em seguida — são duas chamadas porque a API não
   * tem um "criar acesso" único. Se a segunda falhar, o usuário fica criado e
   * sem portal, então a mensagem diz exatamente isso em vez de "erro".
   */
  invite(): void {
    const customer = this.accessCustomer();
    if (!customer || this.inviteForm.invalid || this.accessSaving()) return;

    const { nome, email, password } = this.inviteForm.value;
    const login = loginFrom(String(nome), String(email));

    this.accessSaving.set(true);

    this.authService.registerUser({
      login,
      email: String(email),
      password: String(password),
      roles: ['CLIENTE'],
    }).subscribe({
      next: () => this.linkInvited(login, customer.codParceiro),
      error: err => {
        this.accessSaving.set(false);
        this.toast('error', err?.error || 'Não foi possível criar o acesso');
      },
    });
  }

  private linkInvited(login: string, codParceiro: string): void {
    this.customerService.linkUser(login, codParceiro).subscribe({
      next: () => {
        this.accessSaving.set(false);
        this.inviteForm.reset();
        this.toast('success', `Acesso criado para ${login}`);
        this.loadAccess();
      },
      error: () => {
        this.accessSaving.set(false);
        this.toast('error', `Usuário ${login} foi criado, mas não ficou vinculado. Tente vincular de novo.`);
        this.loadAccess();
      },
    });
  }

  removeAccess(user: ClientUser): void {
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

  private toast(severity: 'success' | 'error', detail: string): void {
    this.messageService.add({
      severity,
      summary: severity === 'success' ? 'Pronto' : 'Erro',
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
      nome: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
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

/**
 * Login a partir do nome e do e-mail: `bruno.rodrigues`, e o trecho antes do
 * arroba quando o nome não serve. Sem acento nem espaço, porque o login é
 * digitado no celular e precisa ser previsível.
 */
function loginFrom(nome: string, email: string): string {
  const clean = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '.')
    .replace(/^\.+|\.+$/g, '');

  const fromName = clean(nome);
  return fromName.length >= 3 ? fromName : clean(email.split('@')[0]);
}

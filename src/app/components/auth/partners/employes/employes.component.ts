import {Component, OnInit, computed, effect, inject, signal, untracked} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormGroup, FormBuilder, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ContractType, Employee, SiteAccess, TransportType } from '../../../../domain/models/employee.model';
import { Menu } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { downloadFileResponse } from '../../../../infrastructure/services/tools/pdf-tools.service';
import { AuthService } from '../../../../infrastructure/services/auth.service';
import { UserResponseDTO } from '../../../../domain/models/user.model';
import { CompanyStore, HierarchyStore, TeamStore } from '../../../../infrastructure/state/org-structure.store';
import { PositionStore } from '../../../../infrastructure/state/position.store';
import { EmployeeStore } from '../../../../infrastructure/state/employee.store';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { EmployeeService } from '../../../../infrastructure/services/partners/employee/employee.service';
import { ErpPartner } from '../../../../domain/models/erp-partner.model';
import { TabDirtyCheck } from '../../../../infrastructure/routing/tab-dirty-check';
import { formatDateOnly, parseDateOnly } from '../../../../domain/utils/date-only';
import { PositionLevelService } from '../../../../infrastructure/services/hr/position-level.service';
import { CareerHistoryService } from '../../../../infrastructure/services/hr/career-history.service';
import { MessageService } from 'primeng/api';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToolbarModule } from 'primeng/toolbar';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import {Toast} from "primeng/toast";
import {PkButtonComponent} from "../../../theme/ProautoKimium/pk-button/pk-button.component";
import {Tooltip} from "primeng/tooltip";
import {PkDialogComponent} from "../../../theme/ProautoKimium/pk-dialog/pk-dialog.component";
import {PkTableComponent} from "../../../theme/ProautoKimium/pk-table/pk-table.component";
import { FormScreenComponent } from '../../shared/form-screen/form-screen.component';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import {PkInputComponent} from "../../../theme/ProautoKimium/pk-input/pk-input.component";
import {PkCheckboxComponent} from "../../../theme/ProautoKimium/pk-checkbox/pk-checkbox.component";
import { lerValorDoCampo } from '../../../../infrastructure/validators/valor-decimal';



import { EmployeeBiometricDevicesComponent } from './employee-biometric-devices/employee-biometric-devices.component';
@Component({
    selector: 'app-employes',
  imports: [EmployeeBiometricDevicesComponent, TableModule, CommonModule, ButtonModule, ToolbarModule, SelectModule,
    DialogModule, InputTextModule, ReactiveFormsModule, FormsModule, CheckboxModule, DatePickerModule, Toast, PkButtonComponent, Tooltip, PkDialogComponent, PkTableComponent, ToolbarComponent, FormScreenComponent, PkInputComponent, PkCheckboxComponent, Menu],
    templateUrl: './employes.component.html',
    styleUrl: './employes.component.scss',
    providers: [MessageService]
})
export class EmployesComponent implements TabDirtyCheck {

  /**
   * A aba avisa antes de fechar se houver cadastro em andamento — o formulário
   * de funcionário é o maior do sistema, perder ele em silêncio seria caro.
   */
  isTabDirty(): boolean {
    return (this.mode() === 'form' && this.form.dirty)
      || (this.careerDialogVisible && this.careerForm.dirty);
  }

  closeForm(): void {
    this.mode.set('grid');
  }

  /**
   * A lista vem do store: esta tela cadastra, e as telas de RH que dependem
   * de funcionário se atualizam sozinhas — sem cada uma buscar a sua cópia.
   */
  private readonly employeeStore = inject(EmployeeStore);
  readonly employes = this.employeeStore.items;
  readonly loading = this.employeeStore.loading;

  // ─── Acesso ao site ────────────────────────────────────────────────────────
  //
  // Pedido do RH (2026-10-08): ver quem já entrou no site e cobrar quem não
  // entrou. A situação vem da API junto com o funcionário (`siteAccess`); a
  // lista de contas da Administração só serve de reserva para uma API mais
  // velha que o site.

  readonly accessFilter = signal<'todos' | 'ACTIVE' | 'PENDING'>('todos');
  readonly downloading = signal(false);

  /**
   * A situação de cada funcionário.
   *
   * **Desligado fica de fora, tenha conta ou não.** Quem bloqueia a conta é o
   * "Ativo" do funcionário: inativar já bloqueia (decisão dele, 2026-10-08). A
   * coluna Ativo diz isso, e um filtro "Bloqueados" só repetiria a coluna.
   * Também não é "pendente": ninguém precisa cobrar o cadastro de quem saiu.
   *
   * Sobra o BLOCKED de quem está ativo mas teve a conta bloqueada pela
   * Administração: aparece no selo, sem filtro próprio.
   */
  accessOf(emp: Employee): SiteAccess | 'INACTIVE' {
    if (!emp.ativo) return 'INACTIVE';
    return emp.siteAccess ?? (this.linkedUserOf(emp) ? 'ACTIVE' : 'PENDING');
  }

  /** O login que aparece no selo: o da API, ou o da lista de contas. */
  loginOf(emp: Employee): string | null {
    return emp.siteLogin ?? this.linkedUserOf(emp);
  }

  /** "pediu o código em 03/10, não concluiu" ou "nunca entrou". */
  pendingDetail(emp: Employee): string {
    if (!emp.firstAccessRequestedAt) return 'nunca entrou';
    const data = new Date(emp.firstAccessRequestedAt);
    const dia = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `pediu o código em ${dia}, não concluiu`;
  }

  readonly accessCounts = computed(() => {
    const total = { todos: 0, ACTIVE: 0, PENDING: 0 };
    for (const e of this.employes()) {
      total.todos++;
      const situacao = this.accessOf(e);
      if (situacao === 'ACTIVE' || situacao === 'PENDING') total[situacao]++;
    }
    return total;
  });

  readonly accessOptions = computed(() => {
    const n = this.accessCounts();
    return [
      { value: 'todos' as const, label: 'Todos', count: n.todos },
      { value: 'ACTIVE' as const, label: 'Com acesso', count: n.ACTIVE },
      { value: 'PENDING' as const, label: 'Pendentes', count: n.PENDING },
    ];
  });

  /** O que a tabela mostra: a busca de texto continua no pk-table, por cima disto. */
  readonly visibleEmployes = computed(() => {
    const filtro = this.accessFilter();
    const todos = this.employes();
    return filtro === 'todos' ? todos : todos.filter(e => this.accessOf(e) === filtro);
  });

  readonly reportItems: MenuItem[] = [
    { label: 'Excel (.xlsx)', icon: 'pi pi-file-excel', command: () => this.downloadPendingReport('xlsx') },
    { label: 'PDF', icon: 'pi pi-file-pdf', command: () => this.downloadPendingReport('pdf') },
  ];

  downloadPendingReport(format: 'xlsx' | 'pdf'): void {
    this.downloading.set(true);
    this.employeeService.downloadPendingSiteAccessReport(format).subscribe({
      next: resposta => {
        this.downloading.set(false);
        if (!downloadFileResponse(resposta, `funcionarios-sem-acesso.${format}`)) {
          this.msgService.add({ severity: 'warn', summary: 'Relatório vazio', detail: 'A API não mandou o arquivo.' });
        }
      },
      error: () => {
        this.downloading.set(false);
        this.msgService.add({ severity: 'error', summary: 'Não deu', detail: 'Não foi possível gerar o relatório dos pendentes.' });
      },
    });
  }
  /** grade ou formulário — o cadastro de funcionário não usa mais diálogo. */
  readonly mode = signal<'grid' | 'form'>('grid');

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  /**
   * `?editar=<id>`: o "Editar dados" da ficha volta para cá com o formulário
   * aberto. Signal, e não leitura no ngOnInit: a tela fica viva entre abas, e o
   * ngOnInit não roda de novo quando a pessoa volta para ela.
   */
  private readonly editParam = toSignal(this.route.queryParamMap, { requireSync: true });

  /** Abre o formulário assim que a pessoa pedida está no cadastro, e limpa o `?editar`. */
  private readonly openFromProfile = effect(() => {
    const id = this.editParam().get('editar');
    if (!id) return;
    const found = this.employes().find(e => e.id === id);
    if (!found) return;
    untracked(() => {
      this.editEmploye(found);
      this.router.navigate([], { relativeTo: this.route, queryParams: { editar: null },
                                 queryParamsHandling: 'merge', replaceUrl: true });
    });
  });
  employee: Employee | null = null;
  form: FormGroup;
  careerForm: FormGroup;
  dialogTitle: string = 'Adicionar Funcionário';
  employeToEdit: Employee | null = null;

  // Vínculo organizacional / cargo inicial (Estrutura Organizacional + Cargos & Níveis)
  private readonly companyStore = inject(CompanyStore);
  private readonly teamStore = inject(TeamStore);
  private readonly hierarchyStore = inject(HierarchyStore);

  /**
   * Espelha o `teamId` do formulario num signal.
   *
   * `computed` so reage a signals, e um `FormControl` nao e um. Sem este
   * espelho o departamento derivado ficaria congelado no primeiro valor.
   */
  private readonly teamIdSelecionado = signal<string | null>(null);
  private readonly positionStore = inject(PositionStore);

  /**
   * Empresas, setores e cargos vêm dos stores compartilhados: cadastrar um
   * cargo na aba de Cargos & Níveis aparece aqui na hora, mesmo com este
   * formulário já aberto e preenchido.
   */
  readonly companyOptions = computed(() =>
    this.companyStore.items().map(company => ({ label: company.name, value: company.id })));
  /**
   * **O setor vem acompanhado do departamento.**
   *
   * Nome de setor se repete entre departamentos — "Administrativo" e
   * "Produção" existem em mais de um —, e sozinho ele não diz qual é qual.
   * Quem preenche a ficha escolhia entre duas linhas idênticas.
   *
   * O departamento já vem no `Team` que a API devolve; a lista é que não
   * usava. Quando faltar, mostra só o setor: `undefined` no rótulo seria pior
   * que a ambiguidade.
   */
  readonly teamOptions = computed(() =>
    this.teamStore.items().map(team => ({
      label: team.department?.name ? `${team.name} - ${team.department.name}` : team.name,
      value: team.id,
    })));
  readonly positionOptions = computed(() =>
    this.positionStore.items().map(position => ({ label: position.name, value: position.id })));

  /**
   * **A hierarquia vem do cadastro, nao de um enum no codigo.**
   *
   * Eram sete valores escritos em `employee.model.ts` — cadastrar uma
   * hierarquia em Estrutura Organizacional nao a fazia aparecer aqui, porque
   * esta lista nunca olhou para o cadastro.
   *
   * Ordenada por `levelOrder`: hierarquia tem ordem natural (Diretor acima de
   * Analista), e listar em ordem alfabetica esconderia isso.
   */
  readonly hierarchyOptions = computed(() =>
    [...this.hierarchyStore.items()]
      .sort((a, b) => a.levelOrder - b.levelOrder)
      .map(hierarchy => ({ label: hierarchy.name, value: hierarchy.id })));

  /**
   * O departamento do setor escolhido — **exibicao, nao campo**.
   *
   * O funcionario nao guarda mais departamento proprio: quem decide e o setor,
   * e mostrar isso na hora evita que a pessoa escolha um setor achando que o
   * departamento e outro. Vazio ate escolherem o setor.
   */
  readonly departamentoDoSetor = computed(() => {
    const teamId = this.teamIdSelecionado();
    if (!teamId) return null;
    return this.teamStore.items().find(team => team.id === teamId)?.department?.name ?? null;
  });

  positionLevelOptions: {label: string, value: string}[] = [];
  contractTypeOptions: {label: string, value: ContractType}[] = [
    { label: 'CLT', value: ContractType.CLT },
    { label: 'PJ', value: ContractType.PJ },
  ];

  transportTypeOptions: {label: string, value: TransportType}[] = [
    { label: 'Ônibus Municipal', value: TransportType.MUNICIPAL_BUS },
    { label: 'Ônibus Intermunicipal', value: TransportType.INTERMUNICIPAL_BUS },
    { label: 'Veículo Próprio', value: TransportType.VEHICLE },
  ];

  // Atribuir cargo (CareerHistory)
  careerDialogVisible = false;
  careerTarget: Employee | null = null;
  careerSaving = false;
  careerPositionOptions: {label: string, value: string}[] = [];
  careerLevelOptions: {label: string, value: string}[] = [];

  // ─── Buscar no ERP ─────────────────────────────────────────────────────────
  private readonly employeeService = inject(EmployeeService);

  erpBuscando = signal(false);
  erpParceiro = signal<ErpPartner | null>(null);
  erpErro = signal<string | null>(null);

  /**
   * Código que já é de um funcionário trava o salvar.
   *
   * Desde a V101 o `cod_parceiro` é único em `parceiros`: o insert bateria no
   * índice e voltaria erro depois de a pessoa ter preenchido empresa, setor,
   * cargo, nível, contrato e data de admissão. Já ser cliente é aviso e segue —
   * quem decide é ela, e o cadastro do cliente é outro assunto.
   */
  erpTravado = computed(() => this.erpParceiro()?.conflict === 'ALREADY_AN_EMPLOYEE');

  private limpaErp(): void {
    this.erpParceiro.set(null);
    this.erpErro.set(null);
  }

  /**
   * Preenche nome, documento e e-mail a partir do CODPARC.
   *
   * Antes disto, cadastrar quem já existe no ERP era redigitar os três — e um
   * dígito errado no CPF não aparece em lugar nenhum, só no primeiro acesso,
   * que é por CPF e simplesmente não encontra a pessoa.
   */
  buscarNoErp(): void {
    const codigo = Number(this.form.get('partnerCode')?.value);
    if (!codigo) {
      this.erpErro.set('Informe o código do parceiro antes de buscar.');
      return;
    }

    this.limpaErp();
    this.erpBuscando.set(true);

    this.employeeService.lookupInErp(codigo).subscribe({
      next: (parceiro) => {
        this.erpBuscando.set(false);
        this.erpParceiro.set(parceiro);

        // Conflito de funcionário não preenche nada: o cadastro já existe, e
        // preencher o formulário sugeriria que dá para salvar.
        if (parceiro.conflict === 'ALREADY_AN_EMPLOYEE') return;

        this.form.patchValue({
          name: parceiro.name,
          document: parceiro.document,
          // E-mail nulo não apaga o que a pessoa já digitou.
          ...(parceiro.email ? { email: parceiro.email } : {}),
        });
        this.form.markAsDirty();
      },
      error: (err) => {
        this.erpBuscando.set(false);
        this.erpErro.set(err?.status === 404
          ? `Código ${codigo} não existe no Sankhya.`
          : this.getErrorMessage(err));
      }
    });
  }

  // Vínculo usuário <-> funcionário
  //
  // Num sinal, e não num array solto: as contagens do filtro de acesso são
  // `computed`, e só se refazem quando a lista de contas chega se ela avisar.
  private readonly usersList = signal<UserResponseDTO[]>([]);
  get users(): UserResponseDTO[] { return this.usersList(); }
  set users(lista: UserResponseDTO[]) { this.usersList.set(lista); }
  linkVisible = false;
  linkTarget: Employee | null = null;
  selectedUserLogin: string | null = null;
  linkSaving = false;

  constructor(
    private authService: AuthService,
    private positionLevelService: PositionLevelService,
    private careerHistoryService: CareerHistoryService,
    private fb: FormBuilder,
    private msgService: MessageService
  ){
    this.form = this.fb.group({
      partnerCode: ['', Validators.required],
      document: [''],
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      ativo: [true, Validators.required],
      managerCode: [''],
      hierarchyId: [null, Validators.required],
      birthday: [null],
      companyId: [null, Validators.required],
      teamId: [null, Validators.required],
      positionId: [null, Validators.required],
      positionLevelId: [{ value: null, disabled: true }, Validators.required],
      contractType: [ContractType.CLT, Validators.required],
      hiringDate: [null, Validators.required],
      transportType: [null],
      dailyCommutesCount: [null],
      dailyMealsCount: [null],
      ticketPrice: [null],
      vehicleKmPerLiter: [null],
      dailyDistanceKm: [null],
    });

    // Trocar o código descarta o resultado anterior: sem isto o aviso de
    // "já é funcionário" continuaria travando o salvar de outro código.
    this.form.get('partnerCode')?.valueChanges.subscribe(() => this.limpaErp());

    this.form.get('teamId')?.valueChanges.subscribe((teamId) => this.teamIdSelecionado.set(teamId ?? null));
    this.form.get('positionId')?.valueChanges.subscribe((positionId) => this.onPositionChange(positionId));
    this.form.get('transportType')?.valueChanges.subscribe((type) => this.onTransportTypeChange(type));

    this.careerForm = this.fb.group({
      positionId: [null, Validators.required],
      positionLevelId: [{ value: null, disabled: true }, Validators.required],
      contractType: [ContractType.CLT, Validators.required],
      hiringDate: [null, Validators.required],
    });

    this.careerForm.get('positionId')?.valueChanges.subscribe((positionId) => this.onCareerPositionChange(positionId));
  }

  /** A ficha do funcionário (2026-10-05): clicar na pessoa abre tudo dela. */
  openProfile(employee: Employee): void {
    if (employee.id) this.router.navigate(['/rh/employees', employee.id]);
  }

  ngOnInit(){
    this.loadUsers();
    this.loadOrgOptions();
  }

  loadOrgOptions(): void {
    // Os stores buscam uma vez e servem todas as telas; chamar aqui é barato.
    this.employeeStore.load();
    this.companyStore.load();
    this.teamStore.load();
    this.hierarchyStore.load();
    this.positionStore.load();
  }

  onPositionChange(positionId: string | null): void {
    const levelControl = this.form.get('positionLevelId');
    levelControl?.reset(null);
    this.positionLevelOptions = [];

    if (!positionId) {
      levelControl?.disable();
      return;
    }

    this.positionLevelService.getByPosition(positionId).subscribe({
      next: (levels) => {
        this.positionLevelOptions = levels.map((l) => ({
          label: `${l.name} — ${l.resolvedSalary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
          value: l.id,
        }));
        levelControl?.enable();
      },
      error: () => {
        this.positionLevelOptions = [];
        levelControl?.disable();
      },
    });
  }

  get isBusType(): boolean {
    const t = this.form.get('transportType')?.value;
    return t === TransportType.MUNICIPAL_BUS || t === TransportType.INTERMUNICIPAL_BUS;
  }

  get isVehicle(): boolean {
    return this.form.get('transportType')?.value === TransportType.VEHICLE;
  }

  onTransportTypeChange(type: TransportType | null): void {
    if (!type || type === TransportType.VEHICLE) {
      this.form.patchValue({ dailyCommutesCount: null, ticketPrice: null }, { emitEvent: false });
    }
    if (!type || type !== TransportType.VEHICLE) {
      this.form.patchValue({ vehicleKmPerLiter: null, dailyDistanceKm: null }, { emitEvent: false });
    }
  }

  private readonly permissions = inject(PermissionStore);

  /**
   * Vincular e desvincular conta é da Administração (decisão dele, 2026-10-08):
   * o RH só vê a situação. É a mesma authority que a API exige nos dois
   * endpoints, então o botão nunca aparece para quem levaria 403.
   */
  readonly canManageLinks = computed(() => this.permissions.can('settings/admin', 'CONFIGURAR'));

  /**
   * A lista de contas é da Administração (`settings/admin`). Para o RH sem ela,
   * o pedido só voltava 403: a situação no site já vem com o funcionário, e o
   * vincular é coisa da Administração.
   */
  loadUsers(){
    if (!this.permissions.can('settings/admin', 'CONSULTAR')) {
      this.users = [];
      return;
    }
    this.authService.getUsers().subscribe({
      next: (list) => this.users = list ?? [],
      error: () => this.users = []   // 404 = nenhum usuário cadastrado ainda
    });
  }

  /** Login do usuário vinculado a um funcionário, ou null. */
  linkedUserOf(emp: Employee): string | null {
    return this.users.find(u => u.codParceiro === emp.partnerCode)?.login ?? null;
  }

  /** Usuários ainda sem funcionário vinculado (mais o já vinculado a este funcionário, ao reabrir). */
  get selectableUsers(): { label: string, value: string }[] {
    const currentLink = this.linkTarget ? this.linkedUserOf(this.linkTarget) : null;
    return this.users
      .filter(u => !u.codParceiro || u.login === currentLink)
      .map(u => ({ label: u.login, value: u.login }));
  }

  openLinkDialog(emp: Employee){
    this.linkTarget = emp;
    this.selectedUserLogin = this.linkedUserOf(emp);
    this.linkVisible = true;
  }

  confirmLink(){
    if(!this.linkTarget || !this.selectedUserLogin) return;
    this.linkSaving = true;
    this.authService.linkEmployee(this.selectedUserLogin, this.linkTarget.partnerCode).subscribe({
      next: () => {
        this.linkSaving = false;
        this.linkVisible = false;
        this.loadUsers();
        this.msgService.add({ severity: 'success', summary: 'Vinculado', detail: 'Usuário vinculado ao funcionário.' });
      },
      error: (err) => {
        this.linkSaving = false;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.linkErrorMessage(err) });
      }
    });
  }

  unlink(emp: Employee){
    const login = this.linkedUserOf(emp);
    if(!login) return;
    this.authService.unlinkEmployee(login).subscribe({
      next: () => {
        this.loadUsers();
        this.msgService.add({ severity: 'info', summary: 'Desvinculado', detail: 'Vínculo removido.' });
      },
      error: (err) => this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.linkErrorMessage(err) })
    });
  }

  private linkErrorMessage(err: any): string {
    return typeof err?.error === 'string' && err.error ? err.error : this.getErrorMessage(err);
  }

  loadEmployes(){
    this.employeeStore.refresh();
  }

  editEmploye(employee: Employee){
    this.dialogTitle = 'Editar funcionário';
    this.employeToEdit = employee;

    // Cargo/nível/contrato/admissão só existem na criação (viram o primeiro CareerHistory) — não editáveis por aqui.
    this.form.get('positionId')?.disable();
    this.form.get('positionLevelId')?.disable();
    this.form.get('contractType')?.disable();
    this.form.get('hiringDate')?.disable();

    this.form.patchValue({
      partnerCode: employee.partnerCode,
      document: employee.document,
      name: employee.name,
      email: employee.email,
      ativo: employee.ativo,
      managerCode: employee.managerCode,
      hierarchyId: employee.hierarchyId ?? null,
      // A API manda "1990-05-20"; o datepicker precisa de Date, senão o campo
      // abre vazio mesmo com o dado salvo.
      birthday: parseDateOnly(employee.birthday),
      companyId: employee.companyId ?? null,
      teamId: employee.teamId ?? null,
      positionId: null,
      positionLevelId: null,
      contractType: null,
      hiringDate: null,
      transportType: employee.transportType ?? null,
      dailyCommutesCount: employee.dailyCommutesCount ?? null,
      dailyMealsCount: employee.dailyMealsCount ?? null,
      ticketPrice: employee.ticketPrice ?? null,
      vehicleKmPerLiter: employee.vehicleKmPerLiter ?? null,
      dailyDistanceKm: employee.dailyDistanceKm ?? null,
    });

    this.mode.set('form');
  }

  showDialog() {
    this.dialogTitle = 'Adicionar Funcionário';
    this.employeToEdit = null;
    this.limpaErp();

    this.form.get('positionId')?.enable();
    this.form.get('contractType')?.enable();
    this.form.get('hiringDate')?.enable();

    this.form.reset({
      ativo: true,
      contractType: ContractType.CLT,
    });
    this.mode.set('form');
  }

  save(){
    if(this.form.valid){
      const employee = this.form.value;

      // `toISOString()` passaria por UTC antes de cortar a string e poderia
      // mandar o dia anterior; `formatDateOnly` usa o fuso local.
      if(employee.birthday){
        employee.birthday = formatDateOnly(employee.birthday);
      }
      if(employee.hiringDate){
        employee.hiringDate = formatDateOnly(employee.hiringDate);
      }

      // O campo tem máscara: entrega texto ("4,50"), e a API quer número.
      employee.ticketPrice = lerValorDoCampo(employee.ticketPrice);

      if(this.employeToEdit){
        this.employeeStore.update(employee).subscribe({
          next: () => {
            this.mode.set('grid');
            this.msgService.add({
              severity: 'success',
              summary: 'Sucesso',
              detail: 'Funcionário atualizado com sucesso!'
            });
          },
          error: (err) => {
            this.mode.set('grid');
            this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
          }
        });
      } else {
        this.employeeStore.create(employee).subscribe({
          next: () => {
            this.mode.set('grid');
            this.msgService.add({
              severity: 'success',
              summary: 'Sucesso',
              detail: 'Funcionário cadastrado com sucesso!'
            });
          },
          error: (err) => {
            this.mode.set('grid');
            this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
          }
        });
      }
    }
  }

  openCareerDialog(employee: Employee): void {
    this.careerTarget = employee;
    this.careerForm.reset({ contractType: ContractType.CLT });
    this.careerForm.get('positionLevelId')?.disable();
    this.careerLevelOptions = [];
    this.careerPositionOptions = this.positionOptions();
    this.careerDialogVisible = true;
  }

  onCareerPositionChange(positionId: string | null): void {
    const levelCtrl = this.careerForm.get('positionLevelId');
    levelCtrl?.reset(null);
    this.careerLevelOptions = [];

    if (!positionId) { levelCtrl?.disable(); return; }

    this.positionLevelService.getByPosition(positionId).subscribe({
      next: (levels) => {
        this.careerLevelOptions = levels.map(l => ({
          label: `${l.name} — ${l.resolvedSalary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
          value: l.id,
        }));
        levelCtrl?.enable();
      },
      error: () => { this.careerLevelOptions = []; levelCtrl?.disable(); },
    });
  }

  saveCareer(): void {
    if (!this.careerTarget || this.careerForm.invalid) return;
    this.careerSaving = true;

    const val = this.careerForm.getRawValue();
    // `hiringDate` é obrigatório no careerForm, que já foi validado acima.
    const effectiveDate = formatDateOnly(val.hiringDate)!;

    this.careerHistoryService.create({
      employeeId: this.careerTarget.id!,
      positionId: val.positionId,
      positionLevelId: val.positionLevelId,
      contractType: val.contractType,
      reason: 'HIRING',
      effectiveDate,
    }).subscribe({
      next: () => {
        this.careerSaving = false;
        this.careerDialogVisible = false;
        this.mode.set('grid');
        this.loadEmployes();
        this.msgService.add({ severity: 'success', summary: 'Sucesso', detail: 'Cargo atribuído ao funcionário.' });
      },
      error: (err) => {
        this.careerSaving = false;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  private getErrorMessage(err: any): string {
    switch (err.status) {
      case 400: return err?.error?.message ?? 'Requisição inválida';
      case 403: return err?.error?.message ?? 'Você não tem permissão para esta ação';
      case 404: return 'Recurso não encontrado';
      case 409: return 'Registro já existe';
      case 422: return err?.error?.message ?? 'Dados inválidos';
      case 500: return 'Erro interno do servidor';
      case 0:   return 'Sem conexão com o servidor';
      default:  return `Erro inesperado (${err.status})`;
    }
  }
}

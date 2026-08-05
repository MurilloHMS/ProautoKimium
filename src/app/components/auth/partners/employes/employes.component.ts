import {Component, OnInit, computed, inject, signal} from '@angular/core';
import { FormGroup, FormBuilder, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ContractType, Department, Employee, Hierarchy, TransportType } from '../../../../domain/models/employee.model';
import { EmployeeService } from '../../../../infrastructure/services/partners/employee/employee.service';
import { AuthService } from '../../../../infrastructure/services/auth.service';
import { UserResponseDTO } from '../../../../domain/models/user.model';
import { CompanyStore, TeamStore } from '../../../../infrastructure/state/org-structure.store';
import { PositionStore } from '../../../../infrastructure/state/position.store';
import { TabDirtyCheck } from '../../../../infrastructure/routing/tab-dirty-check';
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



@Component({
    selector: 'app-employes',
  imports: [TableModule, CommonModule, ButtonModule, ToolbarModule, SelectModule,
    DialogModule, InputTextModule, ReactiveFormsModule, FormsModule, CheckboxModule, DatePickerModule, Toast, PkButtonComponent, Tooltip, PkDialogComponent, PkTableComponent, ToolbarComponent, FormScreenComponent, PkInputComponent, PkCheckboxComponent],
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

  employes: Employee[] = [];
  loading: boolean = false;
  /** grade ou formulário — o cadastro de funcionário não usa mais diálogo. */
  readonly mode = signal<'grid' | 'form'>('grid');
  employee: Employee | null = null;
  form: FormGroup;
  careerForm: FormGroup;
  dialogTitle: string = 'Adicionar Funcionário';
  employeToEdit: Employee | null = null;
  hierarchyList: {label: string, value: Hierarchy} [] = []
  departmentList: {label: string, value: Department} [] = []

  // Vínculo organizacional / cargo inicial (Estrutura Organizacional + Cargos & Níveis)
  private readonly companyStore = inject(CompanyStore);
  private readonly teamStore = inject(TeamStore);
  private readonly positionStore = inject(PositionStore);

  /**
   * Empresas, setores e cargos vêm dos stores compartilhados: cadastrar um
   * cargo na aba de Cargos & Níveis aparece aqui na hora, mesmo com este
   * formulário já aberto e preenchido.
   */
  readonly companyOptions = computed(() =>
    this.companyStore.items().map(company => ({ label: company.name, value: company.id })));
  readonly teamOptions = computed(() =>
    this.teamStore.items().map(team => ({ label: team.name, value: team.id })));
  readonly positionOptions = computed(() =>
    this.positionStore.items().map(position => ({ label: position.name, value: position.id })));

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

  // Vínculo usuário <-> funcionário
  users: UserResponseDTO[] = [];
  linkVisible = false;
  linkTarget: Employee | null = null;
  selectedUserLogin: string | null = null;
  linkSaving = false;

  constructor(
    private employeService: EmployeeService,
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
      hierarchy: [Hierarchy.ASSISTENTE, Validators.required],
      birthday: [null],
      department: [Department.ALIMENTOS, Validators.required],
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

  ngOnInit(){
    this.loadHierarchyList();
    this.loadDepartmentList();
    this.loadUsers();
    this.loadOrgOptions();
  }

  loadOrgOptions(): void {
    // Os stores buscam uma vez e servem todas as telas; chamar aqui é barato.
    this.companyStore.load();
    this.teamStore.load();
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

  loadUsers(){
    this.authService.getUsers().subscribe({
      next: (list) => this.users = list ?? [],
      error: () => this.users = []   // 404 = nenhum usuário cadastrado ainda
    });
  }

  /** Login do usuário vinculado a um funcionário, ou null. */
  linkedUserOf(emp: Employee): string | null {
    return this.users.find(u => u.codParceiro === emp.partnerCode)?.login ?? null;
  }

  /** Quantos funcionários (já carregados) ainda não têm usuário vinculado. */
  get unlinkedCount(): number {
    return this.employes.filter(e => !this.linkedUserOf(e)).length;
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

  loadHierarchyList(){
    this.hierarchyList = Object.keys(Hierarchy)
      .filter(key => isNaN(Number(key)))
      .map(key => ({
        label: key.charAt(0).toUpperCase() + key.slice(1).toLowerCase(),
        value: Hierarchy[key as keyof typeof Hierarchy]
      }));
  }

  loadDepartmentList(){
    this.departmentList = Object.keys(Department)
      .filter(key => isNaN(Number(key)))
      .map(key => ({
        label: key.charAt(0).toUpperCase() + key.slice(1).toLowerCase(),
        value: Department[key as keyof typeof Department]
      }));
  }

  loadEmployes(){
    this.loading = true;
    this.employeService.getEmployes().subscribe({
      next: (list) => {
        this.employes = list;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.msgService.add({
          severity: 'warning',
          summary: 'Erro',
          detail: this.getErrorMessage(err)
        });
      }
    });
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
      hierarchy: employee.hierarchy,
      birthday: employee.birthday,
      department: employee.department,
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

      if(employee.birthday instanceof Date){
        employee.birthday = employee.birthday.toISOString().split('T')[0];
      }
      if(employee.hiringDate instanceof Date){
        employee.hiringDate = employee.hiringDate.toISOString().split('T')[0];
      }

      if(this.employeToEdit){
        this.employeService.updateEmploye(employee).subscribe({
          next: () => {
            this.mode.set('grid');
            this.loadEmployes();
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
        this.employeService.addEmploye(employee).subscribe({
          next: () => {
            this.mode.set('grid');
            this.loadEmployes();
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
    const effectiveDate = val.hiringDate instanceof Date
      ? val.hiringDate.toISOString().split('T')[0]
      : val.hiringDate;

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
      case 400: return 'Requisição inválida';
      case 401: return 'Não autorizado. Faça login novamente';
      case 403: return 'Você não tem permissão para esta ação';
      case 404: return 'Recurso não encontrado';
      case 409: return 'Registro já existe';
      case 422: return 'Dados inválidos';
      case 500: return 'Erro interno do servidor';
      case 0:   return 'Sem conexão com o servidor';
      default:  return `Erro inesperado (${err.status})`;
    }
  }
}

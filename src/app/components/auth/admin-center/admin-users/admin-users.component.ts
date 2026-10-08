import { Component, OnInit, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';

import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkInputComponent } from '../../../theme/ProautoKimium/pk-input/pk-input.component';
import { PkPasswordComponent } from '../../../theme/ProautoKimium/pk-password/pk-password.component';
import { PkComboboxComponent } from '../../../theme/ProautoKimium/pk-combobox/pk-combobox.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkSheetComponent } from '../../../theme/ProautoKimium/pk-sheet/pk-sheet.component';
import { PermissionGridComponent } from '../permission-grid/permission-grid.component';
import { ApplyPerson, ApplyTemplateDialogComponent } from '../apply-template-dialog/apply-template-dialog.component';
import { AuthService } from '../../../../infrastructure/services/auth.service';
import { PermissionAdminService } from '../../../../infrastructure/services/permission/permission-admin.service';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { EmployeeStore } from '../../../../infrastructure/state/employee.store';
import { ehCelular } from '../../../../infrastructure/state/eh-celular';
import { UserResponseDTO } from '../../../../domain/models/user.model';
import {
  AppliedTemplate, ApplyResult, PermissionCells, ScreenRow, TemplateSummary, UserGrid,
} from '../../../../domain/models/permission-admin.model';

const SCREEN = 'settings/admin';

/**
 * A aba Usuários: a lista de contas e, ao lado, a conta aberta — os dados dela
 * e o que ela acessa.
 *
 * No celular a lista vira cartões e a conta abre numa folha de baixo, com
 * "Dados" e "Acesso" como abas dentro dela. O miolo é um `ng-template` só,
 * servido às duas molduras: `<ng-content>` repetido nos dois ramos de um `@if`
 * deixaria a folha vazia, com build verde.
 *
 * **Acesso é modelos + grade, e só.** As roles não aparecem: desde a V86 elas
 * não decidem o que a pessoa vê. Mudar uma role aqui e nada acontecer foi a
 * primeira coisa que ele tentou, e é a primeira que qualquer um tentaria.
 */
@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    NgTemplateOutlet, FormsModule, ReactiveFormsModule,
    PkButtonComponent, PkInputComponent, PkPasswordComponent, PkComboboxComponent,
    PkDialogComponent, PkSheetComponent, PermissionGridComponent, ApplyTemplateDialogComponent,
  ],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss',
})
export class AdminUsersComponent implements OnInit {

  private readonly auth = inject(AuthService);
  private readonly api = inject(PermissionAdminService);
  private readonly permissions = inject(PermissionStore);
  private readonly employees = inject(EmployeeStore);
  private readonly toast = inject(MessageService);
  private readonly fb = inject(FormBuilder);

  /** O login que veio no link (`?usuario=`), para abrir direto nele. */
  readonly initialLogin = input<string | null>(null);
  readonly counted = output<number>();

  readonly celular = ehCelular();
  private readonly grid = viewChild(PermissionGridComponent);

  readonly users = signal<UserResponseDTO[]>([]);
  readonly screens = signal<ScreenRow[]>([]);
  readonly templates = signal<TemplateSummary[]>([]);
  readonly loading = signal(true);

  readonly search = signal('');
  readonly selectedLogin = signal<string | null>(null);
  readonly access = signal<UserGrid | null>(null);
  readonly sheetOpen = signal(false);
  /** Só no celular: qual das duas partes a folha mostra. */
  readonly sheetTab = signal<'dados' | 'acesso'>('dados');

  readonly changed = signal(0);
  readonly saving = signal(false);

  readonly canConfigure = computed(() => this.permissions.can(SCREEN, 'CONFIGURAR'));

  readonly selected = computed(() =>
    this.users().find(u => u.login === this.selectedLogin()) ?? null);

  /** A grade abre em leitura sem ALTERAR — e sempre para o desenvolvedor, onde escrever não mudaria nada. */
  readonly canEditAccess = computed(() =>
    this.permissions.can(SCREEN, 'ALTERAR') && !this.selected()?.developer);

  readonly visibleUsers = computed(() => {
    const termo = this.search().trim().toLowerCase();
    return this.users().filter(u => !termo
      || this.nameOf(u).toLowerCase().includes(termo)
      || u.login.toLowerCase().includes(termo)
      || (u.email ?? '').toLowerCase().includes(termo));
  });

  /** Quem pode receber modelo ou servir de origem para cópia: nem cliente, nem desenvolvedor. */
  readonly people = computed<ApplyPerson[]>(() => this.users()
    .filter(u => !u.client && !u.developer)
    .map(u => ({ id: u.id, name: this.nameOf(u), login: u.login })));

  readonly divergences = computed(() => {
    const pessoa = this.access();
    if (!pessoa) return 0;
    const agora = chaves(pessoa.cells);
    const peloModelo = chaves(pessoa.appliedCells);
    if (!peloModelo.size) return 0;
    let total = 0;
    for (const chave of agora) if (!peloModelo.has(chave)) total++;
    for (const chave of peloModelo) if (!agora.has(chave)) total++;
    return total;
  });

  // ─── Dados da conta ────────────────────────────────────────────────────────

  readonly emailDraft = signal('');
  readonly emailError = signal('');
  readonly savingEmail = signal(false);
  readonly employeeCode = signal<string | null>(null);

  readonly emailChanged = computed(() => {
    const atual = this.selected()?.email ?? '';
    return this.emailDraft().trim() !== atual;
  });

  /** Ativos, com o código ao lado: dois "João" na empresa não podem virar um. */
  readonly employeeOptions = computed(() => this.employees.items()
    .filter(e => e.ativo && e.partnerCode)
    .map(e => ({ label: `${e.name} · ${e.partnerCode}`, value: e.partnerCode }))
    .sort((a, b) => a.label.localeCompare(b.label)));

  // ─── Diálogos ──────────────────────────────────────────────────────────────

  readonly applyOpen = signal(false);
  readonly undoTemplate = signal<AppliedTemplate | null>(null);
  readonly copyOpen = signal(false);
  readonly copySourceId = signal<string | null>(null);
  readonly unlinkOpen = signal(false);

  readonly undoKeeps = computed(() => {
    const alvo = this.undoTemplate();
    const pessoa = this.access();
    if (!alvo || !pessoa) return 0;
    return pessoa.appliedTemplates.filter(t => t.id !== alvo.id).length;
  });

  readonly copyCandidates = computed(() =>
    this.people().filter(p => p.id !== this.selected()?.id));

  readonly selectedPerson = computed<ApplyPerson | null>(() => {
    const u = this.selected();
    return u ? { id: u.id, name: this.nameOf(u), login: u.login } : null;
  });

  // ─── Cadastro ──────────────────────────────────────────────────────────────

  readonly createOpen = signal(false);
  readonly creating = signal(false);
  readonly createForm: FormGroup = this.buildCreateForm();

  ngOnInit(): void {
    this.api.screens().subscribe({
      next: telas => this.screens.set(telas),
      error: () => this.falhou('Não foi possível carregar o catálogo de telas.'),
    });
    this.api.templates().subscribe({
      next: modelos => this.templates.set(modelos.filter(m => m.active)),
      error: () => this.falhou('Não foi possível carregar os modelos.'),
    });
    this.employees.load();
    this.reloadUsers(true);
  }

  isTabDirty(): boolean {
    return this.changed() > 0 || this.emailChanged() || (this.createOpen() && this.createForm.dirty);
  }

  nameOf(user: UserResponseDTO): string {
    return user.employeeName || user.login;
  }

  private reloadUsers(abrirPrimeiro = false): void {
    this.auth.getUsers().subscribe({
      next: contas => {
        const ordenadas = [...contas].sort((a, b) => this.nameOf(a).localeCompare(this.nameOf(b)));
        this.users.set(ordenadas);
        this.counted.emit(ordenadas.length);
        this.loading.set(false);

        if (!abrirPrimeiro) return;
        const pedida = ordenadas.find(u => u.login === this.initialLogin());
        // No celular nada abre sozinho: a folha cobriria a lista que a pessoa veio ver.
        const alvo = pedida ?? (this.celular() ? null : ordenadas[0]);
        if (alvo) this.select(alvo, !!pedida);
      },
      error: () => {
        this.loading.set(false);
        this.falhou('Não foi possível carregar os usuários.');
      },
    });
  }

  select(user: UserResponseDTO, abrirFolha = true): void {
    if (user.login !== this.selectedLogin() && this.changed() > 0
        && !confirm('Há alterações de acesso não salvas. Trocar de usuário descarta.')) return;

    this.selectedLogin.set(user.login);
    this.emailDraft.set(user.email ?? '');
    this.emailError.set('');
    this.employeeCode.set(null);
    this.sheetTab.set('dados');
    this.access.set(null);
    this.changed.set(0);
    if (this.celular() && abrirFolha) this.sheetOpen.set(true);

    // Cliente não tem grade: o acesso dele vem do cadastro do cliente.
    if (!user.client) this.loadAccess(user.id);
  }

  closeSheet(): void {
    if (this.changed() > 0 && !confirm('Há alterações de acesso não salvas. Fechar descarta.')) return;
    this.grid()?.discard();
    this.sheetOpen.set(false);
  }

  private loadAccess(userId: string): void {
    this.api.userGrid(userId).subscribe({
      next: grade => {
        if (this.selected()?.id === userId) this.access.set(grade);
      },
      error: () => this.falhou('Não foi possível abrir o acesso desta pessoa.'),
    });
  }

  private afterAccessChange(): void {
    const user = this.selected();
    this.reloadUsers();
    if (user) this.loadAccess(user.id);
  }

  // ─── Dados: e-mail, vínculo, bloqueio, senha ───────────────────────────────

  saveEmail(): void {
    const user = this.selected();
    const email = this.emailDraft().trim();
    if (!user) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.emailError.set('E-mail inválido.');
      return;
    }

    this.emailError.set('');
    this.savingEmail.set(true);
    this.auth.updateUser(user.login, { email }).subscribe({
      next: () => {
        this.savingEmail.set(false);
        this.patchUser(user.login, { email });
        this.toast.add({ severity: 'success', summary: 'E-mail salvo', detail: `${this.nameOf(user)} agora usa ${email}.` });
      },
      error: (erro: HttpErrorResponse) => {
        this.savingEmail.set(false);
        // 409 e 400 trazem a frase certa; ela fica embaixo do campo, onde o olho está.
        this.emailError.set(erro.error?.message ?? 'Não foi possível salvar o e-mail.');
      },
    });
  }

  link(): void {
    const user = this.selected();
    const codigo = this.employeeCode();
    if (!user || !codigo) return;

    this.auth.linkEmployee(user.login, codigo).subscribe({
      next: () => {
        const funcionario = this.employees.items().find(e => e.partnerCode === codigo);
        this.patchUser(user.login, { codParceiro: codigo, employeeName: funcionario?.name ?? null });
        this.employeeCode.set(null);
        this.toast.add({ severity: 'success', summary: 'Funcionário vinculado' });
      },
      error: (erro: HttpErrorResponse) =>
        this.falhou(erro.error?.message ?? 'Não foi possível vincular o funcionário.'),
    });
  }

  confirmUnlink(): void {
    const user = this.selected();
    if (!user) return;

    this.auth.unlinkEmployee(user.login).subscribe({
      next: () => {
        this.unlinkOpen.set(false);
        this.patchUser(user.login, { codParceiro: null, employeeName: null });
        this.toast.add({ severity: 'success', summary: 'Vínculo removido' });
      },
      error: () => this.falhou('Não foi possível remover o vínculo.'),
    });
  }

  toggleBlock(): void {
    const user = this.selected();
    if (!user) return;
    const acao$ = user.active ? this.auth.blockUser(user.login) : this.auth.unblockUser(user.login);

    acao$.subscribe({
      next: () => {
        this.patchUser(user.login, { active: !user.active });
        this.toast.add({
          severity: 'success',
          summary: user.active ? 'Acesso bloqueado' : 'Acesso liberado',
          detail: user.active
            ? `${this.nameOf(user)} não entra mais até ser liberado.`
            : `${this.nameOf(user)} já pode entrar.`,
        });
      },
      error: () => this.falhou('Não foi possível alterar o acesso.'),
    });
  }

  resetPassword(): void {
    const user = this.selected();
    if (!user) return;

    this.auth.resetPasswordByAdmin(user.login).subscribe({
      next: () => this.toast.add({
        severity: 'success', summary: 'Redefinição enviada', detail: `O e-mail foi para ${user.email}.`,
      }),
      error: () => this.falhou('Não foi possível enviar a redefinição de senha.'),
    });
  }

  /** A lista é a fonte da tela; mexer nela no lugar evita recarregar tudo a cada clique. */
  private patchUser(login: string, mudancas: Partial<UserResponseDTO>): void {
    this.users.set(this.users().map(u => u.login === login ? { ...u, ...mudancas } : u));
  }

  // ─── Acesso ────────────────────────────────────────────────────────────────

  saveAccess(): void {
    const grade = this.grid();
    const pessoa = this.access();
    if (!grade || !pessoa) return;

    this.saving.set(true);
    this.api.saveUserGrid(pessoa.id, grade.current()).subscribe({
      next: resultado => {
        this.saving.set(false);
        this.afterAccessChange();
        this.toast.add({
          severity: 'success',
          summary: 'Acesso salvo',
          detail: `${resultado.cellsChanged} ${resultado.cellsChanged === 1 ? 'alteração' : 'alterações'}. `
            + 'Vale na próxima ação dela; o menu muda quando ela recarregar a página.',
        });
      },
      error: () => {
        this.saving.set(false);
        this.falhou('Não foi possível salvar o acesso.');
      },
    });
  }

  discardAccess(): void {
    this.grid()?.discard();
  }

  onApplied(resultado: ApplyResult): void {
    this.applyOpen.set(false);
    this.afterAccessChange();
    this.toast.add({
      severity: 'success',
      summary: 'Modelo aplicado',
      detail: `${resultado.cellsChanged} ${resultado.cellsChanged === 1 ? 'liberação mudou' : 'liberações mudaram'}.`,
    });
  }

  /**
   * Desfazer desliga o que **aquele** modelo deu, e nada mais: o que outro
   * modelo aplicado também dá fica de pé. Quem faz a conta é a API.
   */
  confirmUndo(): void {
    const pessoa = this.access();
    const modelo = this.undoTemplate();
    if (!pessoa || !modelo) return;

    this.api.undoApply(pessoa.id, modelo.id).subscribe({
      next: resultado => {
        this.undoTemplate.set(null);
        this.afterAccessChange();
        this.toast.add({
          severity: 'success',
          summary: `${modelo.name} desfeito`,
          detail: resultado.cellsChanged === 0
            ? 'Nada saiu: os outros modelos já davam tudo o que ele dava.'
            : `${resultado.cellsChanged} ${resultado.cellsChanged === 1 ? 'liberação saiu' : 'liberações saíram'}.`,
        });
      },
      error: () => this.falhou('Não foi possível desfazer o modelo.'),
    });
  }

  openCopy(): void {
    this.copySourceId.set(null);
    this.copyOpen.set(true);
  }

  confirmCopy(): void {
    const pessoa = this.access();
    const origem = this.copySourceId();
    if (!pessoa || !origem) {
      this.falhou('Escolha de quem copiar.');
      return;
    }

    this.api.copyFrom(pessoa.id, origem).subscribe({
      next: resultado => {
        this.copyOpen.set(false);
        this.afterAccessChange();
        this.toast.add({
          severity: 'success',
          summary: 'Acesso copiado',
          detail: `${resultado.cellsChanged} ${resultado.cellsChanged === 1 ? 'liberação mudou' : 'liberações mudaram'}.`,
        });
      },
      error: () => this.falhou('Não foi possível copiar o acesso.'),
    });
  }

  // ─── Cadastro ──────────────────────────────────────────────────────────────

  openCreate(): void {
    this.createForm.reset();
    this.createOpen.set(true);
  }

  submitCreate(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const valor = this.createForm.value;
    this.creating.set(true);
    this.auth.registerUser({
      login: valor.login,
      email: valor.email,
      password: valor.password,
      // Tipo de conta, e nada mais: o acesso vem dos modelos, e o cadastro já
      // nasce com o Base.
      roles: ['USER'],
    }).subscribe({
      next: () => {
        this.creating.set(false);
        this.createOpen.set(false);
        this.toast.add({ severity: 'success', summary: 'Usuário criado', detail: 'Ele já nasce com o modelo Base.' });
        this.reloadAndOpen(valor.login);
      },
      error: (erro: HttpErrorResponse) => {
        this.creating.set(false);
        this.falhou(erro.error?.message ?? (typeof erro.error === 'string' ? erro.error : 'Não foi possível criar o usuário.'));
      },
    });
  }

  private reloadAndOpen(login: string): void {
    this.auth.getUsers().subscribe({
      next: contas => {
        const ordenadas = [...contas].sort((a, b) => this.nameOf(a).localeCompare(this.nameOf(b)));
        this.users.set(ordenadas);
        this.counted.emit(ordenadas.length);
        const nova = ordenadas.find(u => u.login === login);
        if (nova) this.select(nova);
      },
    });
  }

  fieldError(campo: string): string {
    const controle = this.createForm.get(campo);
    if (!controle || !controle.invalid || !(controle.dirty || controle.touched)) return '';
    const e = controle.errors ?? {};
    if (e['required']) return 'Obrigatório.';
    if (e['email']) return 'E-mail inválido.';
    if (e['minlength']) return `Mínimo de ${e['minlength'].requiredLength} caracteres.`;
    if (e['pattern']) return 'Só letras, números e ponto.';
    if (e['passwordMismatch']) return 'As senhas não batem.';
    return '';
  }

  private buildCreateForm(): FormGroup {
    return this.fb.group({
      login: ['', [Validators.required, Validators.minLength(3), Validators.pattern('^[a-zA-Z0-9.]+$')]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    }, { validators: senhasBatem });
  }

  falhou(detail: string): void {
    this.toast.add({ severity: 'error', summary: 'Não deu', detail });
  }
}

function chaves(cells: PermissionCells): Set<string> {
  const set = new Set<string>();
  for (const [tela, acoes] of Object.entries(cells ?? {})) {
    for (const acao of acoes ?? []) set.add(`${tela}:${acao}`);
  }
  return set;
}

function senhasBatem(form: FormGroup) {
  const senha = form.get('password');
  const confirma = form.get('confirmPassword');
  if (senha?.value && confirma && senha.value !== confirma.value) {
    confirma.setErrors({ passwordMismatch: true });
    return { passwordMismatch: true };
  }
  return null;
}

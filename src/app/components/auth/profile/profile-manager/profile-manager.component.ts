import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { QRCodeComponent } from 'angularx-qrcode';
import { MessageService, ConfirmationService } from 'primeng/api';
import {ChipModule} from "primeng/chip";
import {ProfileCreateDto, ProfileResponseDto} from "../../../../domain/models/profile.model";
import {VcardService} from "../../../../infrastructure/services/profile/vcard/vcard.service";
import {Textarea} from "primeng/textarea";

const EMPTY_FORM = (): ProfileCreateDto => ({
  nome: '', slug: '', cargo: '', empresa: '',
  email: '', imagem: '', descricao: '',
  telefones: [], redesSociais: [],
  regioesAtendimento: [], segmentosAtendimento: [],
  ativo: true,
});

@Component({
  selector: 'app-profile-manager',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, ButtonModule, DialogModule, InputTextModule,
    ToastModule, TagModule, TooltipModule, SkeletonModule,
    SelectModule, ChipModule, ToggleSwitchModule,
    ConfirmDialogModule, QRCodeComponent, Textarea,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './profile-manager.component.html',
  styleUrl: './profile-manager.component.scss',
})
export class ProfileManagerComponent implements OnInit {
  private service = inject(VcardService);
  private toast   = inject(MessageService);
  private confirm = inject(ConfirmationService);

  profiles: ProfileResponseDto[] = [];
  filtered: ProfileResponseDto[] = [];
  loading  = false;
  saving   = false;
  submitted = false;
  searchTerm = '';

  // dialog editar/criar
  dialogVisible = false;
  editingId: string | null = null;
  form: ProfileCreateDto = EMPTY_FORM();

  // dialog QR
  qrVisible = false;
  qrProfile: ProfileResponseDto | null = null;

  readonly phoneTypes = [
    { label: 'WhatsApp', value: 'WHATSAPP' },
    { label: 'Celular',  value: 'CELULAR'  },
    { label: 'Telefone', value: 'TELEFONE' },
    { label: 'Fixo',     value: 'FIXO'     },
  ];

  readonly socialTypes = [
    { label: 'Instagram', value: 'INSTAGRAM' },
    { label: 'LinkedIn',  value: 'LINKEDIN'  },
    { label: 'Facebook',  value: 'FACEBOOK'  },
    { label: 'YouTube',   value: 'YOUTUBE'   },
    { label: 'Twitter',   value: 'TWITTER'   },
    { label: 'TikTok',    value: 'TIKTOK'    },
  ];

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.service.getAll().subscribe({
      next: data => { this.profiles = data; this.applyFilter(); this.loading = false; },
      error: ()   => { this.loading = false; this.toast.add({ severity: 'error', summary: 'Erro', detail: 'Erro ao carregar perfis.' }); },
    });
  }

  onSearch(): void { this.applyFilter(); }

  clearSearch(): void { this.searchTerm = ''; this.applyFilter(); }

  private applyFilter(): void {
    const q = this.searchTerm.trim().toLowerCase();
    this.filtered = q
      ? this.profiles.filter(p =>
        p.nome?.toLowerCase().includes(q) ||
        p.cargo?.toLowerCase().includes(q) ||
        p.slug?.toLowerCase().includes(q) ||
        p.empresa?.toLowerCase().includes(q))
      : [...this.profiles];
  }

  openNew(): void {
    this.editingId = null;
    this.form = EMPTY_FORM();
    this.submitted = false;
    this.dialogVisible = true;
  }

  openEdit(p: ProfileResponseDto): void {
    this.editingId = p.id;
    this.form = {
      nome: p.nome, slug: p.slug, cargo: p.cargo, empresa: p.empresa,
      email: p.email, imagem: p.imagem, descricao: p.descricao,
      telefones: p.telefones ? [...p.telefones.map(t => ({ ...t }))] : [],
      redesSociais: p.redesSociais ? [...p.redesSociais.map(r => ({ ...r }))] : [],
      regioesAtendimento: p.regioesAtendimento ? [...p.regioesAtendimento] : [],
      segmentosAtendimento: p.segmentosAtendimento ? [...p.segmentosAtendimento] : [],
      ativo: p.ativo,
    };
    this.submitted = false;
    this.dialogVisible = true;
  }

  closeDialog(): void { this.dialogVisible = false; }

  save(): void {
    this.submitted = true;
    if (!this.form.nome || !this.form.slug) return;

    this.form.regioesAtendimento = this.form.regioesAtendimento
      .map(r => r?.trim())
      .filter(Boolean) as string[];

    this.form.segmentosAtendimento = this.form.segmentosAtendimento
      .map(s => s?.trim())
      .filter(Boolean) as string[];

    this.saving = true;
    const req = this.editingId
      ? this.service.update(this.editingId, this.form)
      : this.service.create(this.form);

    req.subscribe({
      next: () => {
        this.saving = false;
        this.dialogVisible = false;
        this.toast.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: this.editingId ? 'Perfil atualizado.' : 'Perfil criado.'
        });
        this.load();
      },
      error: () => {
        this.saving = false;
        this.toast.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Não foi possível salvar.'
        });
      }
    });
  }

  slugify(): void {
    this.form.slug = this.form.slug
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  addPhone():   void { this.form.telefones.push({ tipo: 'WHATSAPP', numero: '' }); }
  removePhone(i: number): void { this.form.telefones.splice(i, 1); }

  addSocial():  void { this.form.redesSociais.push({ tipo: 'INSTAGRAM', url: '' }); }
  removeSocial(i: number): void { this.form.redesSociais.splice(i, 1); }

  openQr(p: ProfileResponseDto): void { this.qrProfile = p; this.qrVisible = true; }

  confirmDelete(p: ProfileResponseDto): void {
    this.confirm.confirm({
      message: `Deseja excluir o perfil de <strong>${p.nome}</strong>? Esta ação não pode ser desfeita.`,
      header: 'Confirmar Exclusão',
      icon: 'pi pi-trash',
      acceptLabel: 'Excluir',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-outlined p-button-sm',
      accept: () => {
        this.service.delete(p.id).subscribe({
          next: () => {
            this.toast.add({ severity: 'success', summary: 'Excluído', detail: `Perfil "${p.nome}" removido.` });
            this.load();
          },
          error: () => this.toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível excluir.' }),
        });
      },
    });
  }

  publicUrl(slug: string): string { return `${window.location.origin}/profile/${slug}`; }

  initials(nome: string): string {
    return (nome ?? '').split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
  }

  addRegiao(): void {
    this.form.regioesAtendimento.push('');
  }

  removeRegiao(i: number): void {
    this.form.regioesAtendimento.splice(i, 1);
  }

  addSegmento(): void {
    this.form.segmentosAtendimento.push('');
  }

  removeSegmento(i: number): void {
    this.form.segmentosAtendimento.splice(i, 1);
  }
}

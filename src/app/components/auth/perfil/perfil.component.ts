import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { Textarea } from 'primeng/textarea';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { QRCodeComponent } from 'angularx-qrcode';
import { MessageService } from 'primeng/api';

import { VcardService } from '../../../infrastructure/services/profile/vcard/vcard.service';
import { AuthService } from '../../../infrastructure/services/auth.service';
import {
  MyProfileResponseDto,
  ProfileCreateDto,
  ProfileResponseDto,
} from '../../../domain/models/profile.model';

const EMPTY_FORM = (): ProfileCreateDto => ({
  nome: '', slug: '', cargo: '', empresa: '',
  email: '', imagem: '', descricao: '',
  telefones: [], redesSociais: [],
  regioesAtendimento: [], segmentosAtendimento: [],
  ativo: true,
});

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, DialogModule, InputTextModule,
    ToastModule, SelectModule, TooltipModule,
    Textarea, ProgressSpinnerModule, QRCodeComponent,
  ],
  providers: [MessageService],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.scss',
})
export class PerfilComponent implements OnInit {
  private vcardService = inject(VcardService);
  private authService = inject(AuthService);
  private toast = inject(MessageService);

  data: MyProfileResponseDto | null = null;
  loading = true;
  saving = false;
  editing = false;

  form: ProfileCreateDto = EMPTY_FORM();

  imagePreview: string | null = null;
  selectedFile: File | null = null;
  uploadingImage = false;

  qrVisible = false;

  readonly phoneTypes = [
    { label: 'WhatsApp', value: 'WHATSAPP' },
    { label: 'Celular',  value: 'CELULAR' },
    { label: 'Telefone', value: 'TELEFONE' },
    { label: 'Fixo',     value: 'FIXO' },
  ];

  readonly socialTypes = [
    { label: 'Instagram', value: 'INSTAGRAM' },
    { label: 'LinkedIn',  value: 'LINKEDIN' },
    { label: 'Facebook',  value: 'FACEBOOK' },
    { label: 'YouTube',   value: 'YOUTUBE' },
    { label: 'Twitter',   value: 'TWITTER' },
    { label: 'TikTok',    value: 'TIKTOK' },
  ];

  get hasProfile(): boolean {
    return !!this.data?.profile;
  }

  get canCreate(): boolean {
    return !!this.data?.canCreateProfile;
  }

  get profileUrl(): string {
    if (!this.data?.profile?.slug) return '';
    return `${window.location.origin}/profile/${this.data.profile.slug}`;
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.vcardService.getMyProfile().subscribe({
      next: (res) => {
        this.data = res;
        this.loading = false;
        if (res.profile) {
          this.patchForm(res.profile);
        }
      },
      error: () => {
        this.loading = false;
        this.toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar seu perfil.' });
      },
    });
  }

  startEditing(): void {
    if (this.data?.profile) {
      this.patchForm(this.data.profile);
    } else {
      this.form = EMPTY_FORM();
      this.form.nome = this.data?.employeeName ?? '';
      this.form.email = this.data?.employeeEmail ?? '';
      this.form.empresa = this.data?.employeeEmpresa ?? 'Proauto Kimium';
    }
    this.editing = true;
  }

  cancelEditing(): void {
    this.editing = false;
    this.imagePreview = null;
    this.selectedFile = null;
    if (this.data?.profile) {
      this.patchForm(this.data.profile);
    }
  }

  save(): void {
    if (!this.form.nome) {
      this.toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Nome é obrigatório.' });
      return;
    }

    this.form.regioesAtendimento = this.form.regioesAtendimento
      .map(r => r?.trim()).filter(Boolean) as string[];
    this.form.segmentosAtendimento = this.form.segmentosAtendimento
      .map(s => s?.trim()).filter(Boolean) as string[];

    this.saving = true;

    const req = this.hasProfile
      ? this.vcardService.updateMyProfile(this.form)
      : this.vcardService.createMyProfile(this.form);

    req.subscribe({
      next: () => {
        if (this.selectedFile) {
          this.uploadImage(() => this.onSaveSuccess());
        } else {
          this.onSaveSuccess();
        }
      },
      error: () => {
        this.saving = false;
        this.toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível salvar.' });
      },
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.selectedFile = input.files[0];

    const reader = new FileReader();
    reader.onload = (e) => {
      this.imagePreview = e.target?.result as string;
    };
    reader.readAsDataURL(this.selectedFile);
  }

  openQr(): void {
    this.qrVisible = true;
  }

  downloadQr(): void {
    const canvas = document.querySelector('.qr-dialog-body qrcode canvas') as HTMLCanvasElement;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `qrcode-${this.data?.profile?.slug ?? 'perfil'}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        navigator.share({ files: [file] }).catch(() => this.downloadBlob(blob));
      } else {
        this.downloadBlob(blob);
      }
    }, 'image/png');
  }

  downloadVCard(): void {
    if (!this.data?.profile?.slug) return;
    this.vcardService.downloadVCard(this.data.profile.slug).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.data!.profile!.slug}.vcf`;
        a.click();
        URL.revokeObjectURL(url);
      },
    });
  }

  initials(name: string): string {
    return (name ?? '').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  addPhone(): void { this.form.telefones.push({ tipo: 'WHATSAPP', numero: '' }); }
  removePhone(i: number): void { this.form.telefones.splice(i, 1); }

  addSocial(): void { this.form.redesSociais.push({ tipo: 'INSTAGRAM', url: '' }); }
  removeSocial(i: number): void { this.form.redesSociais.splice(i, 1); }

  addRegiao(): void { this.form.regioesAtendimento.push(''); }
  removeRegiao(i: number): void { this.form.regioesAtendimento.splice(i, 1); }

  addSegmento(): void { this.form.segmentosAtendimento.push(''); }
  removeSegmento(i: number): void { this.form.segmentosAtendimento.splice(i, 1); }

  private patchForm(p: ProfileResponseDto): void {
    this.form = {
      nome: p.nome, slug: p.slug, cargo: p.cargo, empresa: p.empresa,
      email: p.email, imagem: p.imagem, descricao: p.descricao,
      telefones: p.telefones ? [...p.telefones.map(t => ({ ...t }))] : [],
      redesSociais: p.redesSociais ? [...p.redesSociais.map(r => ({ ...r }))] : [],
      regioesAtendimento: p.regioesAtendimento ? [...p.regioesAtendimento] : [],
      segmentosAtendimento: p.segmentosAtendimento ? [...p.segmentosAtendimento] : [],
      ativo: p.ativo,
    };
    this.imagePreview = p.imagem || null;
  }

  private uploadImage(onDone: () => void): void {
    if (!this.selectedFile) { onDone(); return; }
    this.uploadingImage = true;
    this.vcardService.uploadMyProfileImage(this.selectedFile).subscribe({
      next: () => { this.uploadingImage = false; this.selectedFile = null; onDone(); },
      error: () => {
        this.uploadingImage = false;
        this.toast.add({ severity: 'warn', summary: 'Aviso', detail: 'Perfil salvo, mas a foto não foi enviada.' });
        onDone();
      },
    });
  }

  private onSaveSuccess(): void {
    this.saving = false;
    this.editing = false;
    this.toast.add({
      severity: 'success', summary: 'Sucesso',
      detail: this.hasProfile ? 'Perfil atualizado.' : 'Cartão digital criado!',
    });
    this.load();
  }

  private downloadBlob(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qrcode-${this.data?.profile?.slug ?? 'perfil'}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

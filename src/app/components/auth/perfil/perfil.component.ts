import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { Textarea } from 'primeng/textarea';
import { InputMask } from 'primeng/inputmask';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { QRCodeComponent } from 'angularx-qrcode';
import { MessageService } from 'primeng/api';

import { VcardService } from '../../../infrastructure/services/profile/vcard/vcard.service';
import { AuthService } from '../../../infrastructure/services/auth.service';
import { PermissionStore } from '../../../infrastructure/state/permission.store';
import { APP_MENU, MOBILE_NAV, AppMenuItem } from '../../../layouts/auth-layout/menu.config';
import { urlDeMidia } from '../../../infrastructure/config/media-url';
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

/** Uma tela que a pessoa alcança, com o que ela pode fazer lá dentro. */
export interface AcessoDaTela {
  screen: string;
  label: string;
  consultar: boolean;
  incluir: boolean;
  alterar: boolean;
  excluir: boolean;
}

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, DialogModule, InputTextModule,
    ToastModule, SelectModule, TooltipModule,
    Textarea, InputMask, ProgressSpinnerModule, QRCodeComponent,
  ],
  providers: [MessageService],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.scss',
})
export class PerfilComponent implements OnInit, OnDestroy {
  private vcardService = inject(VcardService);
  private authService = inject(AuthService);
  private permissions = inject(PermissionStore);
  private toast = inject(MessageService);

  data: MyProfileResponseDto | null = null;
  loading = true;

  /**
   * O que a API respondeu quando não deu para carregar.
   *
   * A tela tinha `@if (loading) @else if (data)` e mais nada: no erro ela
   * ficava **em branco**, com um toast vermelho que some sozinho. Quem chegava
   * depois de três segundos via uma página vazia sem explicação nenhuma.
   */
  errorMessage: string | null = null;

  /** A conta não está ligada a um funcionário — o caso que tem saída conhecida. */
  notLinked = false;
  saving = false;
  editing = false;

  form: ProfileCreateDto = EMPTY_FORM();

  avatarBroken = false;
  imagePreview: string | null = null;
  selectedFile: File | null = null;
  uploadingImage = false;

  qrVisible = false;

  // ── Conta e acesso ────────────────────────────────────────────────────────
  //
  // Nada aqui custa uma requisição nova: o login e os papéis saem do token, e o
  // mapa de permissões já está no `PermissionStore`, carregado para o menu e os
  // guards. A tela só estava sem mostrar o que o cliente já sabia.

  /** Reavaliado de minuto em minuto — é o que faz a contagem andar sozinha. */
  private readonly agora = signal(Date.now());
  private relogio?: ReturnType<typeof setInterval>;

  readonly login = this.authService.getUsername();
  readonly roles = this.authService.getUserRoles();
  readonly sessionExpiresAt = this.authService.getExpirationDate();

  /** Quanto falta para a sessão vencer, em minutos; negativo = já venceu. */
  readonly minutosRestantes = computed(() => {
    if (!this.sessionExpiresAt) return null;
    return Math.round((this.sessionExpiresAt.getTime() - this.agora()) / 60000);
  });

  /**
   * "1h 42min", "8min", "expirada".
   *
   * O acesso dura 2h e é renovado por um refresh de 7 dias, então este número
   * quase sempre volta a encher sozinho. Ele responde "quanto tempo esta aba
   * aguenta parada", que é a pergunta de quem deixa o sistema aberto.
   */
  readonly sessionLabel = computed(() => {
    const min = this.minutosRestantes();
    if (min === null) return 'desconhecida';
    if (min <= 0) return 'expirada';
    const horas = Math.floor(min / 60);
    const resto = min % 60;
    return horas ? `${horas}h ${resto.toString().padStart(2, '0')}min` : `${resto}min`;
  });

  /** Fração já consumida das 2h, para a barrinha. */
  readonly sessionFraction = computed(() => {
    const min = this.minutosRestantes();
    if (min === null) return 0;
    return Math.max(0, Math.min(1, min / 120));
  });

  /** Mostra as três primeiras telas até a pessoa pedir a lista inteira. */
  readonly showAllScreens = signal(false);

  /**
   * As telas que a pessoa alcança, com os quatro verbos por linha.
   *
   * A chave do mapa é o código da tela (`stock/movements`); o rótulo humano
   * vive no `APP_MENU`. Quando não houver rótulo — tela nova, ou item que saiu
   * do menu — mostra o próprio código, que é feio mas verdadeiro. Esconder a
   * linha seria pior: a pessoa TEM a permissão, e ela não apareceria em lugar
   * nenhum.
   */
  readonly acessos = computed<AcessoDaTela[]>(() => {
    const mapa = this.permissions.permissions();
    const rotulos = ROTULO_POR_TELA();

    return Object.entries(mapa)
      .map(([screen, verbos]) => ({
        screen,
        label: rotulos.get(screen) ?? screen,
        consultar: verbos.includes('CONSULTAR'),
        incluir:   verbos.includes('INCLUIR'),
        alterar:   verbos.includes('ALTERAR'),
        excluir:   verbos.includes('EXCLUIR'),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  });

  readonly acessosVisiveis = computed(() =>
    this.showAllScreens() ? this.acessos() : this.acessos().slice(0, 3));

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

  /**
   * Pode criar o cartão digital?
   *
   * Quem decide é a API, por `perfil:INCLUIR`. A tela de perfil em si é de
   * todo mundo — o que se controla aqui é a seção de dentro, e é o primeiro
   * lugar do sistema onde "abrir a tela" e "fazer algo nela" se separam.
   */
  get canCreate(): boolean {
    return !!this.data?.canCreateProfile;
  }

  get profileUrl(): string {
    if (!this.data?.profile?.slug) return '';
    return `${window.location.origin}/profile/${this.data.profile.slug}`;
  }

  ngOnInit(): void {
    this.load();

    // Idempotente: se o menu já carregou o mapa, isto não vai à rede.
    this.permissions.ensureLoaded().subscribe();

    this.relogio = setInterval(() => this.agora.set(Date.now()), 60_000);
  }

  ngOnDestroy(): void {
    clearInterval(this.relogio);
  }

  /** Sai da conta encerrando a sessão do lado do servidor também. */
  logout(): void {
    this.authService.logoutRemoto().subscribe(() => (window.location.href = '/'));
  }

  load(): void {
    this.loading = true;
    this.errorMessage = null;
    this.notLinked = false;

    this.vcardService.getMyProfile().subscribe({
      next: (res) => {
        this.data = res;
        this.loading = false;
        if (res.profile) {
          this.patchForm(res.profile);
        }
      },
      error: (erro) => {
        this.loading = false;

        // O 404 daqui não é "não existe": é a conta sem vínculo com um
        // funcionário. A API manda a frase com a saída — quem pedir e para
        // quem — e a tela mostra isso em vez de um "erro" genérico.
        this.notLinked = erro?.status === 404;
        this.errorMessage = erro?.error?.message
          ?? 'Não foi possível carregar seu perfil. Tente novamente em instantes.';

        // Sem toast no caso conhecido: a mensagem fica NA TELA, e um toast que
        // some em três segundos é o contrário do que alguém travado precisa.
        if (!this.notLinked) {
          this.toast.add({ severity: 'error', summary: 'Erro', detail: this.errorMessage ?? undefined });
        }
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

    this.form.redesSociais = this.form.redesSociais.map(rs => ({
      ...rs,
      url: this.normalizeSocialUrl(rs.tipo, rs.url),
    }));
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

  formatPhone(value: string): string {
    const digits = (value ?? '').replace(/\D/g, '');
    const clean = digits.startsWith('55') && digits.length > 11 ? digits.substring(2) : digits;
    if (clean.length === 11) {
      return `(${clean.substring(0, 2)}) ${clean.substring(2, 7)}-${clean.substring(7)}`;
    }
    if (clean.length === 10) {
      return `(${clean.substring(0, 2)}) ${clean.substring(2, 6)}-${clean.substring(6)}`;
    }
    return value;
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

  private readonly socialBaseUrls: Record<string, string> = {
    INSTAGRAM: 'https://instagram.com/',
    TIKTOK:    'https://tiktok.com/@',
    TWITTER:   'https://x.com/',
  };

  normalizeSocialUrl(tipo: string, url: string): string {
    const trimmed = (url ?? '').trim();
    if (!trimmed) return trimmed;
    const base = this.socialBaseUrls[tipo];
    if (!base) return trimmed;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    const handle = trimmed.startsWith('@') ? trimmed.substring(1) : trimmed;
    return base + handle;
  }

  socialPlaceholder(tipo: string): string {
    switch (tipo) {
      case 'INSTAGRAM': return '@usuario ou https://instagram.com/usuario';
      case 'TIKTOK':    return '@usuario ou https://tiktok.com/@usuario';
      case 'TWITTER':   return '@usuario ou https://x.com/usuario';
      default:          return 'https://…';
    }
  }

  private downloadBlob(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qrcode-${this.data?.profile?.slug ?? 'perfil'}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * A foto do funcionário vem da API como caminho relativo — em produção o site
   * e a API são hosts diferentes, e o navegador procuraria no domínio errado.
   *
   * O `(error)` do `<img>` já esconde a falha trocando pelas iniciais, e é por
   * isso que este defeito passou tanto tempo despercebido aqui: a tela nunca
   * pareceu quebrada, só nunca mostrou a foto.
   */
  urlDaFoto(caminho: string | null | undefined): string {
    return urlDeMidia(caminho, '');
  }
}

/**
 * `screen` → rótulo, achatado a partir dos menus uma vez só.
 *
 * **Os dois menus, e não só o `APP_MENU`.** `perfil` — a própria tela onde
 * este mapa é usado — só existe no `MOBILE_NAV`; com uma fonte só, ela caía
 * na regra do "sem rótulo" e se listava como `perfil`, em minúscula, no meio
 * de nomes de gente. O `APP_MENU` vem primeiro porque a trilha dele é mais
 * completa ("RH › Férias" em vez de "Férias"), e `set` só preenche o que
 * ainda não existe.
 *
 * Os menus são constantes de módulo, então o mapa não muda em tempo de
 * execução; montar a cada `computed` seria varrer as árvores a cada render.
 */
const ROTULO_POR_TELA = (() => {
  let cache: Map<string, string> | null = null;

  return (): Map<string, string> => {
    if (cache) return cache;

    const mapa = new Map<string, string>();
    const visitar = (itens: AppMenuItem[], caminho: string[]): void => {
      for (const item of itens) {
        const trilha = [...caminho, item.label];
        if (item.screen && !mapa.has(item.screen)) mapa.set(item.screen, trilha.join(' › '));
        if (item.items?.length) visitar(item.items, trilha);
      }
    };

    visitar(APP_MENU, []);
    visitar(MOBILE_NAV, []);

    cache = mapa;
    return cache;
  };
})();

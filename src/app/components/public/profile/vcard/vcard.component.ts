import {Component, inject, OnInit} from '@angular/core';
import {CommonModule} from "@angular/common";
import {CardModule} from "primeng/card";
import {ButtonModule} from "primeng/button";
import {SkeletonModule} from "primeng/skeleton";
import {ActivatedRoute} from "@angular/router";
import {ProfileResponseDto} from "../../../../domain/models/profile.model";
import {VcardService} from "../../../../infrastructure/services/profile/vcard/vcard.service";
import {PkBtnSharedComponent} from "../../../../shared/pk-btn-shared/pk-btn-shared.component";
import {PkQrcodeComponent} from "../../../../shared/pk-qrcode/pk-qrcode.component";

interface ContactItem {
  label: string;
  value: string;
  link: string;
  cssClass: string;
  icon: string;
}

const TIPO_MAP: Record<string, { cssClass: string; icon: string; label: string; linkFn: (v: string) => string }> = {
  WHATSAPP:  { cssClass: 'whatsapp',  icon: 'pi pi-whatsapp', label: 'WhatsApp',  linkFn: v => `https://wa.me/55${v.replace(/\D/g,'')}` },
  CELULAR:   { cssClass: 'whatsapp',  icon: 'pi pi-whatsapp', label: 'WhatsApp',  linkFn: v => `https://wa.me/55${v.replace(/\D/g,'')}` },
  TELEFONE:  { cssClass: 'phone',     icon: 'pi pi-phone',    label: 'Telefone',  linkFn: v => `tel:+55${v.replace(/\D/g,'')}` },
  FIXO:      { cssClass: 'phone',     icon: 'pi pi-phone',    label: 'Telefone',  linkFn: v => `tel:+55${v.replace(/\D/g,'')}` },
};

const SOCIAL_MAP: Record<string, { cssClass: string; icon: string; label: string }> = {
  INSTAGRAM: { cssClass: 'instagram', icon: 'pi pi-instagram', label: 'Instagram' },
  LINKEDIN:  { cssClass: 'linkedin',  icon: 'pi pi-linkedin',  label: 'LinkedIn'  },
  FACEBOOK:  { cssClass: 'facebook',  icon: 'pi pi-facebook',  label: 'Facebook'  },
  YOUTUBE:   { cssClass: 'youtube',   icon: 'pi pi-youtube',   label: 'YouTube'   },
  TWITTER:   { cssClass: 'twitter',   icon: 'pi pi-twitter',   label: 'Twitter'   },
  TIKTOK:    { cssClass: 'tiktok',    icon: 'pi pi-tiktok',    label: 'TikTok'    },
};

@Component({
  selector: 'app-vcard',
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    SkeletonModule,
    PkBtnSharedComponent,
    PkQrcodeComponent
  ],
  templateUrl: './vcard.component.html',
  styleUrl: './vcard.component.scss',
})
export class VcardComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private service = inject(VcardService);

  loading = true;
  notFound = false;
  profile: ProfileResponseDto | null = null;

  phoneContacts:   ContactItem[] = [];
  digitalContacts: ContactItem[] = [];
  socialContacts:  ContactItem[] = [];

  get initials(): string {
    if (!this.profile?.nome) return 'PK';
    return this.profile.nome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.service.getBySlug(slug).subscribe({
      next: p  => { this.profile = p; this.buildContacts(); this.loading = false; },
      error: () => { this.notFound = true; this.loading = false; },
    });
  }

  private buildContacts(): void {
    if (!this.profile) return;
    const { telefones, redesSociais, email } = this.profile;

    this.phoneContacts = (telefones ?? []).map(t => {
      const meta = TIPO_MAP[t.tipo?.toUpperCase()] ?? TIPO_MAP['TELEFONE'];
      return { label: meta.label, value: t.numero, link: meta.linkFn(t.numero), cssClass: meta.cssClass, icon: meta.icon };
    });

    this.digitalContacts = [];
    if (email) {
      this.digitalContacts.push({ label: 'E-mail', value: email, link: `mailto:${email}`, cssClass: 'email', icon: 'pi pi-envelope' });
    }
    this.digitalContacts.push({ label: 'Site', value: 'proautokimium.com.br', link: 'https://proautokimium.com.br', cssClass: 'website', icon: 'pi pi-globe' });

    this.socialContacts = (redesSociais ?? []).map(r => {
      const meta = SOCIAL_MAP[r.tipo?.toUpperCase()] ?? { cssClass: 'website', icon: 'pi pi-link', label: r.tipo };
      return { label: meta.label, value: r.url.replace(/^https?:\/\/(www\.)?/, ''), link: r.url, cssClass: meta.cssClass, icon: meta.icon };
    });
  }

  saveContact(): void {
    if (!this.profile) return;
    this.service.downloadVCard(this.profile.slug).subscribe(blob => {
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href     = url;
      link.download = `${this.profile!.slug}.vcf`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  publicUrl(): string{
    return window.location.href;
  }

}

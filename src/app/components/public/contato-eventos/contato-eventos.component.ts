import { Component } from '@angular/core';
import {ButtonModule} from "primeng/button";
import {CardModule} from "primeng/card";
import {CommonModule} from "@angular/common";
import {PkBtnSharedComponent} from "../../theme/ProautoKimium/pk-btn-shared/pk-btn-shared.component";

interface ContactItem {
  type: string;
  label: string;
  value: string;
  link: string;
  cssClass: string;
  icon: string;
}

@Component({
  selector: 'app-contato-eventos',
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    PkBtnSharedComponent
  ],
  templateUrl: './contato-eventos.component.html',
  styleUrl: './contato-eventos.component.scss',
})
export class ContatoEventosComponent {

  whatsappContacts: ContactItem[] = [
    {
      type: 'WhatsApp',
      value: '(11) 9 8358-3564',
      link: 'https://wa.me/5511983583564',
      cssClass: 'whatsapp',
      icon: 'pi pi-whatsapp',
      label: 'WhatsApp'
    },
    {
      type: 'WhatsApp',
      value: '(11) 9 5778-2766',
      link: 'https://wa.me/5511957782766',
      cssClass: 'whatsapp',
      icon: 'pi pi-whatsapp',
      label: 'WhatsApp'
    },
    {
      type: 'Telefone',
      value: '(11) 4577-0399',
      link: 'tel:+551145770399',
      cssClass: 'phone',
      icon: 'pi pi-phone',
      label: 'Telefone'
    }
  ];

  digitalContacts: ContactItem[] = [
    {
      type: 'E-mail SAC',
      value: 'sac@proautokimium.com.br',
      link: 'mailto:sac@proautokimium.com.br',
      cssClass: 'email',
      icon: 'pi pi-envelope',
      label: 'E-mail SAC'
    },
    {
      type: 'Site',
      value: 'proautokimium.com.br',
      link: 'https://proautokimium.com.br',
      cssClass: 'website',
      icon: 'pi pi-globe',
      label: 'Site'
    }
  ];

  socialContacts: ContactItem[] = [
    {
      type: 'Instagram',
      value: '@proautokimium',
      link: 'https://www.instagram.com/proautokimium',
      cssClass: 'instagram',
      icon: 'pi pi-instagram',
      label: 'Instagram'
    },
    {
      type: 'LinkedIn',
      value: 'Proauto Kimium',
      link: 'https://br.linkedin.com/company/proauto-kimium',
      cssClass: 'linkedin',
      icon: 'pi pi-linkedin',
      label: 'LinkedIn'
    }
  ];

  saveContact() {

    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Proauto Kimium',
      'ORG:Proauto Kimium',
      'TEL;TYPE=CELL,PREF:+5511983583564',
      'TEL;TYPE=CELL:+5511957782766',
      'TEL;TYPE=WORK:+551145770399',
      'EMAIL;TYPE=WORK:sac@proautokimium.com.br',
      'URL:https://proautokimium.com.br',
      'END:VCARD'
    ].join('\r\n');

    const blob = new Blob([vcard], {
      type: 'text/vcard'
    });

    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');

    link.href = url;
    link.download = 'Proauto-Kimium.vcf';

    link.click();

    window.URL.revokeObjectURL(url);
  }
}

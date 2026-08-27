import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { PageHeaderComponent } from '../shared/page-header/page-header.component';
import { PermissionStore } from '../../../infrastructure/state/permission.store';

interface CategoriaDoc {
  titulo: string;
  descricao: string;
  icon: string;
  accent: string;
  /** A rota, que é também o código da tela no catálogo de permissões. */
  rota: string;
}

/**
 * O hub de Documentos.
 *
 * Antes ele tinha três cards em "Em breve" — Pessoal, Propostas e Checklist —
 * que existiam há meses e não abriam nada. Um card que não clica ensina a
 * ignorar cards, e depois de um tempo ninguém tenta os que funcionam.
 *
 * O "Pessoal" tinha tela desde sempre (`documentos/rh`, o Portal do
 * funcionário) e só não estava ligado. Os outros dois saíram: sem tela e sem
 * data, "em breve" é uma promessa que o hub não pode cumprir.
 *
 * O que ficou no lugar da promessa é o **controle de acesso**: cada card só
 * aparece para quem consegue abrir a tela dele. Antes, quem não tinha acesso à
 * Galeria via o card, clicava e batia na tela de acesso negado.
 */
@Component({
  selector: 'app-documentos',
  standalone: true,
  imports: [PageHeaderComponent],
  templateUrl: './documentos.component.html',
  styleUrl: './documentos.component.scss',
})
export class DocumentosComponent {

  private readonly router = inject(Router);
  private readonly permissions = inject(PermissionStore);

  private readonly todas: CategoriaDoc[] = [
    { titulo: 'Galeria',     descricao: 'Fotos, logos e catálogos da empresa',      icon: 'pi pi-images',    accent: '#7c5cbf', rota: 'documentos/galeria' },
    { titulo: 'Logos',       descricao: 'Identidade visual e arquivos da marca',    icon: 'pi pi-palette',   accent: '#e07b4c', rota: 'documentos/logos' },
    { titulo: 'Holerites',   descricao: 'Seus demonstrativos de pagamento',         icon: 'pi pi-receipt',   accent: '#d92d20', rota: 'documentos/holerites' },
    { titulo: 'Pessoal',     descricao: 'Suas férias, reembolsos, atestados e documentos', icon: 'pi pi-id-card', accent: '#232e61', rota: 'documentos/rh' },
    { titulo: 'Ferramentas', descricao: 'Desbloquear PDF, renomear NFS-e e outras ferramentas de arquivo', icon: 'pi pi-wrench', accent: 'var(--app-action)', rota: 'tools/pdf' },
  ];

  /**
   * Só o que a pessoa consegue abrir.
   *
   * Usa `canOpen`, e não `can(…, 'CONSULTAR')`: qualquer uma das sete
   * permissões abre a tela — é o técnico que lança um reembolso sem poder ver
   * os dos outros.
   */
  readonly categorias = computed(() =>
    this.todas.filter(cat => this.permissions.canOpen(cat.rota)));

  abrir(cat: CategoriaDoc): void {
    this.router.navigate([cat.rota]);
  }
}

/**
 * Configuração da navegação da área autenticada.
 *
 * Antes isto era um array literal dentro do `ngOnInit` do top-menu. Como
 * configuração separada dá para reaproveitar em três lugares (drawer, busca da
 * topbar e bottom nav do mobile) e testar sem instanciar componente.
 *
 * A configuração é IMUTÁVEL: estado de "submenu aberto" pertence à view, não a ela.
 */

export interface AppMenuItem {
  label: string;
  icon: string;
  /** Rota interna, relativa à raiz (ex.: ['rh/hub']). */
  routerLink?: string[];
  /** Link externo — mutuamente exclusivo com routerLink. */
  url?: string;
  target?: string;
  /** Papéis que enxergam o item. Ausente = visível para todos os logados. */
  roles?: string[];
  badge?: string | number;
  items?: AppMenuItem[];
}

export const APP_MENU: AppMenuItem[] = [
  {
    label: 'Início',
    icon: 'pi pi-fw pi-home',
    routerLink: ['home'],
  },
  {
    label: 'Documentos',
    icon: 'pi pi-fw pi-folder',
    routerLink: ['documentos'],
  },
  {
    label: 'Galeria',
    icon: 'pi pi-fw pi-images',
    routerLink: ['documentos/galeria'],
  },
  {
    label: 'RH - Recursos Humanos',
    icon: 'pi pi-fw pi-users',
    items: [
      { label: 'Painel RH', icon: 'pi pi-fw pi-th-large', routerLink: ['rh/hub'], roles: ['ADMIN', 'RH'] },
      {
        label: 'Aprovações',
        icon: 'pi pi-fw pi-check-circle',
        roles: ['ADMIN', 'RH'],
        items: [
          { label: 'Férias', icon: 'pi pi-fw pi-sun', routerLink: ['rh/vacation-requests'], roles: ['ADMIN', 'RH'] },
          { label: 'Reembolsos', icon: 'pi pi-fw pi-wallet', routerLink: ['rh/reimbursements'], roles: ['ADMIN', 'RH'] },
          { label: 'Atestados', icon: 'pi pi-fw pi-file-check', routerLink: ['rh/medical-certificates'], roles: ['ADMIN', 'RH'] },
        ],
      },
      {
        label: 'Pessoas',
        icon: 'pi pi-fw pi-user',
        roles: ['ADMIN', 'RH'],
        items: [
          { label: 'Funcionários', icon: 'pi pi-fw pi-user', routerLink: ['rh/employees'], roles: ['ADMIN', 'RH'] },
          { label: 'Visão de Equipe', icon: 'pi pi-fw pi-users', routerLink: ['rh/team-overview'], roles: ['ADMIN', 'RH'] },
          { label: 'Calendário', icon: 'pi pi-fw pi-calendar', routerLink: ['rh/calendar'], roles: ['ADMIN', 'RH'] },
        ],
      },
      {
        label: 'Organização',
        icon: 'pi pi-fw pi-sitemap',
        roles: ['ADMIN', 'RH'],
        items: [
          { label: 'Estrutura', icon: 'pi pi-fw pi-sitemap', routerLink: ['rh/organizational-structure'], roles: ['ADMIN', 'RH'] },
          { label: 'Cargos & Níveis', icon: 'pi pi-fw pi-briefcase', routerLink: ['rh/career-structure'], roles: ['ADMIN', 'RH'] },
          { label: 'Equipamentos', icon: 'pi pi-fw pi-desktop', routerLink: ['rh/equipment-assignments'], roles: ['ADMIN', 'RH'] },
        ],
      },
      {
        label: 'Ferramentas',
        icon: 'pi pi-fw pi-wrench',
        roles: ['ADMIN', 'RH'],
        items: [
          { label: 'Calculadoras', icon: 'pi pi-fw pi-calculator', routerLink: ['rh/calculators'], roles: ['ADMIN', 'RH'] },
          { label: 'Holerit', icon: 'pi pi-fw pi-file', routerLink: ['rh/holerit'], roles: ['ADMIN', 'RH'] },
          { label: 'Coletar Holerite', icon: 'pi pi-fw pi-file-arrow-up', routerLink: ['rh/holerit/extractor'], roles: ['ADMIN', 'RH'] },
        ],
      },
      {
        label: 'Comunicação',
        icon: 'pi pi-fw pi-megaphone',
        roles: ['ADMIN', 'RH'],
        items: [
          { label: 'Mural de Avisos', icon: 'pi pi-fw pi-megaphone', routerLink: ['rh/announcements'], roles: ['ADMIN', 'RH'] },
          { label: 'Notificações', icon: 'pi pi-fw pi-bell', routerLink: ['rh/notifications'], roles: ['ADMIN', 'RH'] },
          { label: 'Portal de Vagas', icon: 'pi pi-fw pi-briefcase', routerLink: ['rh/painel-de-vagas'], roles: ['ADMIN', 'RH'] },
        ],
      },
    ],
  },
  {
    label: 'Financeiro',
    icon: 'pi pi-fw pi-money-bill',
    items: [
      { label: 'Gerar Recibos Locação', icon: 'pi pi-fw pi-file-export', routerLink: ['finance/rent-receipt-generator'], roles: ['ADMIN', 'FINANCEIRO'] },
    ],
  },
  {
    label: 'Empresa',
    icon: 'pi pi-fw pi-building',
    items: [
      { label: 'Clientes', icon: 'pi pi-fw pi-user', routerLink: ['company/customers'], roles: ['ADMIN', 'RH', 'MARKETING'] },
      { label: 'Coletar Dados NFe', icon: 'pi pi-fw pi-file', routerLink: ['company/nfe-collector'], roles: ['ADMIN', 'RH', 'FINANCEIRO', 'COMPRADOR'] },
      { label: 'Remover Senha do Excel', icon: 'pi pi-fw pi-lock', routerLink: ['company/excel'] },
      { label: 'Abastecimento', icon: 'pi pi-fw pi-gauge', routerLink: ['company/fuel-supply'], roles: ['ADMIN', 'COMPRADOR'] },
      { label: 'Guia de Utilização', icon: 'pi pi-fw pi-file-pdf', routerLink: ['company/guide'], roles: ['ADMIN', 'CONTRATOS'] },
      { label: 'Equipamentos', icon: 'pi pi-fw pi-wrench', routerLink: ['company/equipments'], roles: ['ADMIN', 'CONTRATOS', 'DESIGN'] },
    ],
  },
  {
    label: 'Comunicação',
    icon: 'pi pi-fw pi-comments',
    items: [
      { label: 'Newsletter', icon: 'pi pi-fw pi-envelope', routerLink: ['communication/newsletter'], roles: ['ADMIN', 'MARKETING'] },
      { label: 'Disparo de Emails', icon: 'pi pi-fw pi-send', routerLink: ['communication/email'], roles: ['ADMIN', 'MARKETING', 'RH', 'SUPPORT', 'DESIGN'] },
      { label: 'Comunicação Protegida', icon: 'pi pi-fw pi-lock', routerLink: ['communication/secrets'], roles: ['ADMIN', 'MARKETING', 'RH', 'VENDEDOR'] },
      { label: 'Assinatura de Email', icon: 'pi pi-fw pi-file', routerLink: ['communication/email-signature'], roles: ['ADMIN', 'RH', 'MARKETING', 'DESIGN'] },
      { label: 'Contato', icon: 'pi pi-fw pi-phone', routerLink: ['communication/contact'], roles: ['ADMIN', 'SUPPORT'] },
    ],
  },
  {
    label: 'Estoque',
    icon: 'pi pi-fw pi-box',
    items: [
      { label: 'Hub das Máquinas', icon: 'pi pi-fw pi-th-large', routerLink: ['stock/hub'], roles: ['ADMIN', 'ALMOXARIFADO'] },
      { label: 'Programação', icon: 'pi pi-fw pi-table', routerLink: ['stock/programacao'], roles: ['ADMIN', 'ALMOXARIFADO'] },
      { label: 'Produtos', icon: 'pi pi-fw pi-box', routerLink: ['stock/products'], roles: ['ADMIN', 'ALMOXARIFADO'] },
      { label: 'Movimentações', icon: 'pi pi-fw pi-arrow-right-arrow-left', routerLink: ['stock/movements'], roles: ['ADMIN', 'ALMOXARIFADO'] },
      { label: 'Máquinas', icon: 'pi pi-fw pi-cog', routerLink: ['stock/machines'], roles: ['ADMIN', 'ALMOXARIFADO'] },
    ],
  },
  {
    label: 'Ferramentas',
    icon: 'pi pi-fw pi-wrench',
    items: [
      { label: 'PDF', icon: 'pi pi-fw pi-file-pdf', routerLink: ['tools/pdf'] },
    ],
  },
  {
    label: 'Configurações',
    icon: 'pi pi-fw pi-cog',
    items: [
      { label: 'Produtos do site', icon: 'pi pi-fw pi-tags', routerLink: ['settings/products/website'], roles: ['ADMIN', 'DESIGN'] },
      { label: 'Faq', icon: 'pi pi-fw pi-question-circle', routerLink: ['faq/manager'], roles: ['ADMIN'] },
      { label: 'Perfil', icon: 'pi pi-fw pi-id-card', routerLink: ['profile-manager'], roles: ['ADMIN'] },
      { label: 'Admin', icon: 'pi pi-fw pi-shield', routerLink: ['settings/admin'], roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Apps Externos',
    icon: 'pi pi-fw pi-external-link',
    items: [
      { label: 'NextCloud', icon: 'pi pi-fw pi-cloud', url: 'https://cloud.proautokimium.com.br/', target: '_blank' },
      { label: 'N8N', icon: 'pi pi-fw pi-cog', url: 'https://n8n.proautokimium.com.br/', target: '_blank' },
      { label: 'PDF', icon: 'pi pi-fw pi-file-pdf', url: 'https://pdf.proautokimium.com.br/', target: '_blank' },
      { label: 'Jenkins', icon: 'pi pi-fw pi-cog', url: 'https://jenkins.proautokimium.com.br/', target: '_blank' },
      { label: 'Api (Documentação)', icon: 'pi pi-fw pi-file', url: 'https://api.proautokimium.com/swagger-ui/index.html', target: '_blank' },
      { label: 'GLPI (Chamados)', icon: 'pi pi-fw pi-ticket', url: 'https://infra.proautokimium.com.br/', target: '_blank' },
    ],
  },
];

/**
 * Bottom nav do mobile — lista própria porque dois destinos ("Avisos" e "Perfil")
 * são páginas pessoais que não aparecem na árvore do drawer. Passa pelo mesmo
 * filtro de papéis do menu principal.
 */
export const MOBILE_NAV: AppMenuItem[] = [
  { label: 'Início', icon: 'pi pi-home', routerLink: ['home'] },
  { label: 'Documentos', icon: 'pi pi-folder', routerLink: ['documentos'] },
  { label: 'Avisos', icon: 'pi pi-megaphone', routerLink: ['documentos/rh/announcements'] },
  { label: 'Perfil', icon: 'pi pi-user', routerLink: ['perfil'] },
];

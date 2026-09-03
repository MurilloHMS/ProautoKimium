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
  /**
   * A tela que este item abre, no catálogo de permissões.
   *
   * Ausente = visível para todos os logados: são os itens que não participam do
   * controle (início, notificações) e as pastas, que aparecem se algum filho
   * aparecer.
   */
  screen?: string;
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
    routerLink: ['documentos'], screen: 'documentos',
  },
  {
    label: 'Galeria',
    icon: 'pi pi-fw pi-images',
    routerLink: ['documentos/galeria'], screen: 'documentos/galeria',
  },
  {
    label: 'RH - Recursos Humanos',
    icon: 'pi pi-fw pi-users',
    items: [
      { label: 'Painel RH', icon: 'pi pi-fw pi-th-large', routerLink: ['rh/hub'], screen: 'rh/hub' },
      {
        label: 'Aprovações',
        icon: 'pi pi-fw pi-check-circle',
        items: [
          { label: 'Férias', icon: 'pi pi-fw pi-sun', routerLink: ['rh/vacation-requests'], screen: 'rh/vacation-requests' },
          { label: 'Reembolsos', icon: 'pi pi-fw pi-wallet', routerLink: ['rh/reimbursements'], screen: 'rh/reimbursements' },
          { label: 'Atestados', icon: 'pi pi-fw pi-file-check', routerLink: ['rh/medical-certificates'], screen: 'rh/medical-certificates' },
        ],
      },
      {
        label: 'Pessoas',
        icon: 'pi pi-fw pi-user',
        items: [
          { label: 'Funcionários', icon: 'pi pi-fw pi-user', routerLink: ['rh/employees'], screen: 'rh/employees' },
          { label: 'Visão de Equipe', icon: 'pi pi-fw pi-users', routerLink: ['rh/team-overview'], screen: 'rh/team-overview' },
          { label: 'Calendário', icon: 'pi pi-fw pi-calendar', routerLink: ['rh/calendar'], screen: 'rh/calendar' },
        ],
      },
      {
        label: 'Organização',
        icon: 'pi pi-fw pi-sitemap',
        items: [
          { label: 'Estrutura', icon: 'pi pi-fw pi-sitemap', routerLink: ['rh/organizational-structure'], screen: 'rh/organizational-structure' },
          { label: 'Cargos & Níveis', icon: 'pi pi-fw pi-briefcase', routerLink: ['rh/career-structure'], screen: 'rh/career-structure' },
          { label: 'Equipamentos', icon: 'pi pi-fw pi-desktop', routerLink: ['rh/equipment-assignments'], screen: 'rh/equipment-assignments' },
        ],
      },
      {
        label: 'Ferramentas',
        icon: 'pi pi-fw pi-wrench',
        items: [
          { label: 'Calculadoras', icon: 'pi pi-fw pi-calculator', routerLink: ['rh/calculators'], screen: 'rh/calculators' },
          { label: 'Holerit', icon: 'pi pi-fw pi-file', routerLink: ['rh/holerit'], screen: 'rh/holerit' },
          { label: 'Coletar Holerite', icon: 'pi pi-fw pi-file-arrow-up', routerLink: ['rh/holerit/extractor'], screen: 'rh/holerit/extractor' },
        ],
      },
      {
        label: 'Comunicação',
        icon: 'pi pi-fw pi-megaphone',
        items: [
          { label: 'Mural de Avisos', icon: 'pi pi-fw pi-megaphone', routerLink: ['rh/announcements'], screen: 'rh/announcements' },
          { label: 'Notificações', icon: 'pi pi-fw pi-bell', routerLink: ['rh/notifications'], screen: 'rh/notifications' },
          { label: 'Portal de Vagas', icon: 'pi pi-fw pi-briefcase', routerLink: ['rh/painel-de-vagas'], screen: 'rh/painel-de-vagas' },
        ],
      },
    ],
  },
  {
    label: 'Financeiro',
    icon: 'pi pi-fw pi-money-bill',
    items: [
      { label: 'Gerar Recibos Locação', icon: 'pi pi-fw pi-file-export', routerLink: ['finance/rent-receipt-generator'], screen: 'finance/rent-receipt-generator' },
    ],
  },
  {
    label: 'Empresa',
    icon: 'pi pi-fw pi-building',
    items: [
      { label: 'Clientes', icon: 'pi pi-fw pi-user', routerLink: ['company/customers'], screen: 'company/customers' },
      { label: 'Coletar Dados NFe', icon: 'pi pi-fw pi-file', routerLink: ['company/nfe-collector'], screen: 'company/nfe-collector' },
      { label: 'Remover Senha do Excel', icon: 'pi pi-fw pi-lock', routerLink: ['company/excel'], screen: 'company/excel' },
      { label: 'Abastecimento', icon: 'pi pi-fw pi-gauge', routerLink: ['company/fuel-supply'], screen: 'company/fuel-supply' },
      { label: 'Hub de Abastecimento', icon: 'pi pi-fw pi-chart-line', routerLink: ['company/fuel-hub'], screen: 'company/fuel-hub' },
      { label: 'Guia de Utilização', icon: 'pi pi-fw pi-file-pdf', routerLink: ['company/guide'], screen: 'company/guide' },
      { label: 'Equipamentos', icon: 'pi pi-fw pi-wrench', routerLink: ['company/equipments'], screen: 'company/equipments' },
    ],
  },
  {
    label: 'Comunicação',
    icon: 'pi pi-fw pi-comments',
    items: [
      { label: 'Newsletter', icon: 'pi pi-fw pi-envelope', routerLink: ['communication/newsletter'], screen: 'communication/newsletter' },
      { label: 'Disparo de Emails', icon: 'pi pi-fw pi-send', routerLink: ['communication/email'], screen: 'communication/email' },
      { label: 'Comunicação Protegida', icon: 'pi pi-fw pi-lock', routerLink: ['communication/secrets'], screen: 'communication/secrets' },
      { label: 'Assinatura de Email', icon: 'pi pi-fw pi-file', routerLink: ['communication/email-signature'], screen: 'communication/email-signature' },
      { label: 'Contato', icon: 'pi pi-fw pi-phone', routerLink: ['communication/contact'], screen: 'communication/contact' },
    ],
  },
  {
    label: 'Estoque',
    icon: 'pi pi-fw pi-box',
    items: [
      { label: 'Hub das Máquinas', icon: 'pi pi-fw pi-th-large', routerLink: ['stock/hub'], screen: 'stock/hub' },
      { label: 'Programação', icon: 'pi pi-fw pi-table', routerLink: ['stock/programacao'], screen: 'stock/programacao' },
      { label: 'Hub do Estoque', icon: 'pi pi-fw pi-chart-bar', routerLink: ['stock/inventory-hub'], screen: 'stock/inventory-hub' },
      { label: 'Produtos', icon: 'pi pi-fw pi-box', routerLink: ['stock/products'], screen: 'stock/products' },
      { label: 'Movimentações', icon: 'pi pi-fw pi-arrow-right-arrow-left', routerLink: ['stock/movements'], screen: 'stock/movements' },
      { label: 'Alertas de saída', icon: 'pi pi-fw pi-bell', routerLink: ['stock/alerts'], screen: 'stock/alerts' },
    ],
  },
  {
    label: 'Ferramentas',
    icon: 'pi pi-fw pi-wrench',
    items: [
      { label: 'PDF', icon: 'pi pi-fw pi-file-pdf', routerLink: ['tools/pdf'], screen: 'tools/pdf' },
      { label: 'Certificados em lote', icon: 'pi pi-fw pi-verified', routerLink: ['tools/certificados'], screen: 'tools/certificados' },
    ],
  },
  {
    label: 'Configurações',
    icon: 'pi pi-fw pi-cog',
    items: [
      { label: 'Produtos do site', icon: 'pi pi-fw pi-tags', routerLink: ['settings/products/website'], screen: 'settings/products/website' },
      { label: 'Faq', icon: 'pi pi-fw pi-question-circle', routerLink: ['faq/manager'], screen: 'faq/manager' },
      { label: 'Perfil', icon: 'pi pi-fw pi-id-card', routerLink: ['profile-manager'], screen: 'profile-manager' },
      { label: 'Admin', icon: 'pi pi-fw pi-shield', routerLink: ['settings/admin'], screen: 'settings/admin' },
      { label: 'Modelos de permissão', icon: 'pi pi-fw pi-bookmark', routerLink: ['settings/permissions/templates'], screen: 'settings/permissions/templates' },
      { label: 'Permissões por usuário', icon: 'pi pi-fw pi-lock', routerLink: ['settings/permissions/users'], screen: 'settings/permissions/users' },
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
 * Bottom nav do mobile — lista própria porque os destinos são páginas pessoais
 * que não aparecem na árvore do drawer. O quinto atalho é preenchido em tempo
 * de execução pela tela mais usada da pessoa (ver TelasRecentesService).
 *
 * "Notificações" está aqui, e não "Avisos", porque só notificação tem estado de
 * lido — é a única que pode acender um ponto honesto. Avisos continua no menu.
 */
export const MOBILE_NAV: AppMenuItem[] = [
  { label: 'Início', icon: 'pi pi-home', routerLink: ['home'] },
  { label: 'Documentos', icon: 'pi pi-folder', routerLink: ['documentos'], screen: 'documentos' },
  { label: 'Notificações', icon: 'pi pi-bell', routerLink: ['notificacoes'] },
  { label: 'Perfil', icon: 'pi pi-user', routerLink: ['perfil'], screen: 'perfil' },
];

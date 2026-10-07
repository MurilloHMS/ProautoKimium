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
  /**
   * Para a tela que junta outras (a Pendências junta férias, reembolsos e
   * atestados): aparece para quem abre **qualquer uma** delas. Não existe código
   * de tela próprio — a grade que o RH já configurou continua valendo.
   */
  anyScreen?: string[];
  /**
   * Outros nomes pelos quais a tela é procurada na busca do topo — os nomes
   * antigos das telas que se juntaram (2026-10-05). Quem digita "mural" acha
   * Comunicados, em vez de "nenhuma página encontrada".
   */
  keywords?: string[];
  badge?: string | number;
  items?: AppMenuItem[];
}

/** As telas que a Pendências junta: quem abre qualquer uma delas abre a Pendências. */
export const PENDING_QUEUE_SCREENS = ['rh/reimbursements', 'rh/vacation-requests', 'rh/medical-certificates', 'rh/document-requests'];

/** As telas que os Comunicados juntam: o Mural de Avisos e as Notificações. */
export const COMMUNICATIONS_SCREENS = ['rh/announcements', 'rh/notifications'];

/** As telas que a Organização junta: a estrutura e os cargos. */
export const ORGANIZATION_SCREENS = ['rh/organizational-structure', 'rh/career-structure'];

/** As telas que as Ausências juntam: a Visão de Equipe e o Calendário. */
export const ABSENCES_SCREENS = ['rh/team-overview', 'rh/calendar'];

/** Holerites: a tela de envio e o Coletar, que virou a 4ª ferramenta dela. */
export const PAYSLIP_SCREENS = ['rh/holerit', 'rh/holerit/extractor'];

export const APP_MENU: AppMenuItem[] = [
  /**
   * As tres entradas pessoais, juntas.
   *
   * Elas eram folhas soltas no primeiro nivel. Na gaveta do celular isso as
   * deixava como tiles avulsos ao lado de categorias, e a forma dizia coisas
   * diferentes lado a lado. Agrupadas, o primeiro nivel fica so de grupos.
   *
   * A mudanca e no APP_MENU e vale para o desktop tambem, por decisao dele em
   * 2026-09-24: o menu do celular e o do computador nao podem divergir.
   */
  {
    label: 'Meu espaço',
    icon: 'pi pi-fw pi-inbox',
    items: [
      {
        label: 'Início',
        icon: 'pi pi-fw pi-home',
        routerLink: ['home'],
      },
      // Sem `screen`: todo funcionário pode ter convite, e quem decide é a API.
      {
        label: 'Meus convites',
        icon: 'pi pi-fw pi-calendar-plus',
        routerLink: ['convites'],
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
      // Estas tres so eram alcancaveis pela pagina Documentos — nao tinham
      // linha no menu, entao nao apareciam na busca nem na gaveta.
      { label: 'Eventos', icon: 'pi pi-fw pi-calendar-clock', routerLink: ['documentos/eventos'], screen: 'documentos/eventos' },
      { label: 'Holerites', icon: 'pi pi-fw pi-credit-card', routerLink: ['documentos/holerites'], screen: 'documentos/holerites' },
      { label: 'Pessoal', icon: 'pi pi-fw pi-user-edit', routerLink: ['documentos/rh'], screen: 'documentos/rh' },
    ],
  },
  {
    label: 'RH - Recursos Humanos',
    icon: 'pi pi-fw pi-users',
    items: [
      // Reorganização do RH (2026-10-05): de 16 itens em 5 grupos para um menu
      // quase plano. As telas que se juntaram não têm código próprio na grade
      // (`anyScreen`); os endereços antigos redirecionam (app.routes.ts).
      { label: 'Painel', icon: 'pi pi-fw pi-objects-column', routerLink: ['rh/hub'], screen: 'rh/hub', keywords: ['Painel RH'] },
      {
        // Pendências é o que espera decisão; as três telas de baixo guardam o
        // histórico (aprovados, pagos, recusados) e os Indicadores.
        label: 'Aprovações',
        icon: 'pi pi-fw pi-check-circle',
        items: [
          {
            label: 'Pendências', icon: 'pi pi-fw pi-hourglass', routerLink: ['rh/pendencias'],
            anyScreen: PENDING_QUEUE_SCREENS,
          },
          { label: 'Férias', icon: 'pi pi-fw pi-sun', routerLink: ['rh/vacation-requests'], screen: 'rh/vacation-requests' },
          { label: 'Reembolsos', icon: 'pi pi-fw pi-wallet', routerLink: ['rh/reimbursements'], screen: 'rh/reimbursements' },
          { label: 'Atestados', icon: 'pi pi-fw pi-file-check', routerLink: ['rh/medical-certificates'], screen: 'rh/medical-certificates' },
        ],
      },
      { label: 'Pessoas', icon: 'pi pi-fw pi-user', routerLink: ['rh/employees'], screen: 'rh/employees', keywords: ['Funcionários', 'Colaboradores', 'Ficha'] },
      { label: 'Documentos', icon: 'pi pi-fw pi-file-edit', routerLink: ['rh/employee-documents'], screen: 'rh/employee-documents' },
      {
        label: 'Solicitações', icon: 'pi pi-fw pi-file-arrow-up', routerLink: ['rh/document-requests'], screen: 'rh/document-requests',
        keywords: ['Pedir documento', 'RG', 'Uniforme', 'Formulário'],
      },
      // Equipamentos fica: é onde se registra a entrega e a devolução, e quem só
      // tem esta tela não abre a ficha do funcionário.
      { label: 'Equipamentos', icon: 'pi pi-fw pi-desktop', routerLink: ['rh/equipment-assignments'], screen: 'rh/equipment-assignments' },
      {
        label: 'Ausências', icon: 'pi pi-fw pi-calendar-times', routerLink: ['rh/ausencias'],
        anyScreen: ABSENCES_SCREENS, keywords: ['Visão de Equipe', 'Calendário', 'Quem está de férias'],
      },
      { label: 'Holerites', icon: 'pi pi-fw pi-receipt', routerLink: ['rh/holerit'], anyScreen: PAYSLIP_SCREENS, keywords: ['Holerit', 'Coletar Holerite', 'Contracheque'] },
      {
        label: 'Organização', icon: 'pi pi-fw pi-sitemap', routerLink: ['rh/organizacao'],
        anyScreen: ORGANIZATION_SCREENS,
        keywords: ['Estrutura', 'Cargos & Níveis', 'Cargos', 'Empresas', 'Departamentos', 'Setores', 'Hierarquias', 'Dissídio'],
      },
      {
        label: 'Comunicados', icon: 'pi pi-fw pi-megaphone', routerLink: ['rh/comunicados'],
        anyScreen: COMMUNICATIONS_SCREENS, keywords: ['Mural de Avisos', 'Notificações', 'Avisos'],
      },
      { label: 'Vagas', icon: 'pi pi-fw pi-user-plus', routerLink: ['rh/painel-de-vagas'], screen: 'rh/painel-de-vagas', keywords: ['Portal de Vagas', 'Banco de talentos', 'Candidaturas'] },
      { label: 'Calculadoras', icon: 'pi pi-fw pi-calculator', routerLink: ['rh/calculators'], screen: 'rh/calculators' },
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
      { label: 'Clientes', icon: 'pi pi-fw pi-shop', routerLink: ['company/customers'], screen: 'company/customers' },
      { label: 'Coletar Dados NFe', icon: 'pi pi-fw pi-barcode', routerLink: ['company/nfe-collector'], screen: 'company/nfe-collector' },
      { label: 'Remover Senha do Excel', icon: 'pi pi-fw pi-file-excel', routerLink: ['company/excel'], screen: 'company/excel' },
      { label: 'Abastecimento', icon: 'pi pi-fw pi-gauge', routerLink: ['company/fuel-supply'], screen: 'company/fuel-supply' },
      { label: 'Hub de Abastecimento', icon: 'pi pi-fw pi-chart-line', routerLink: ['company/fuel-hub'], screen: 'company/fuel-hub' },
      { label: 'Guia de Utilização', icon: 'pi pi-fw pi-book', routerLink: ['company/guide'], screen: 'company/guide' },
      { label: 'Equipamentos', icon: 'pi pi-fw pi-hammer', routerLink: ['company/equipments'], screen: 'company/equipments' },
      // Checklist de vendas (2026-09-30). Aqui, e não num grupo "Vendas": são
      // nove cores de apoio da marca para nove grupos, e um décimo não teria cor
      // própria. Nas permissões as telas ficam no módulo Vendas.
      { label: 'Checklist de vendas', icon: 'pi pi-fw pi-clipboard', routerLink: ['vendas/checklist'], screen: 'vendas/checklist' },
      { label: 'Checklists (Controladoria)', icon: 'pi pi-fw pi-check-square', routerLink: ['vendas/checklists'], screen: 'vendas/checklists' },
      { label: 'Cadastros do checklist', icon: 'pi pi-fw pi-list-check', routerLink: ['vendas/checklist-cadastros'], screen: 'vendas/checklist-cadastros' },
    ],
  },
  {
    label: 'Comunicação',
    icon: 'pi pi-fw pi-comments',
    items: [
      { label: 'Newsletter', icon: 'pi pi-fw pi-envelope', routerLink: ['communication/newsletter'], screen: 'communication/newsletter' },
      { label: 'Disparo de Emails', icon: 'pi pi-fw pi-send', routerLink: ['communication/email'], screen: 'communication/email' },
      { label: 'Comunicação Protegida', icon: 'pi pi-fw pi-key', routerLink: ['communication/secrets'], screen: 'communication/secrets' },
      { label: 'Assinatura de Email', icon: 'pi pi-fw pi-at', routerLink: ['communication/email-signature'], screen: 'communication/email-signature' },
      { label: 'Contato', icon: 'pi pi-fw pi-phone', routerLink: ['communication/contact'], screen: 'communication/contact' },
      { label: 'Eventos', icon: 'pi pi-fw pi-star', routerLink: ['communication/events'], screen: 'communication/events' },
    ],
  },
  {
    label: 'Estoque',
    icon: 'pi pi-fw pi-box',
    items: [
      { label: 'Hub das Máquinas', icon: 'pi pi-fw pi-th-large', routerLink: ['stock/hub'], screen: 'stock/hub' },
      { label: 'Programação', icon: 'pi pi-fw pi-table', routerLink: ['stock/programacao'], screen: 'stock/programacao' },
      { label: 'Hub do Estoque', icon: 'pi pi-fw pi-chart-bar', routerLink: ['stock/inventory-hub'], screen: 'stock/inventory-hub' },
      { label: 'Produtos', icon: 'pi pi-fw pi-tag', routerLink: ['stock/products'], screen: 'stock/products' },
      { label: 'Movimentações', icon: 'pi pi-fw pi-arrow-right-arrow-left', routerLink: ['stock/movements'], screen: 'stock/movements' },
      { label: 'Alertas de saída', icon: 'pi pi-fw pi-bolt', routerLink: ['stock/alerts'], screen: 'stock/alerts' },
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
      { label: 'Fila de e-mails', icon: 'pi pi-fw pi-history', routerLink: ['dev/email-queue'], screen: 'dev/email-queue' },
      { label: 'Remetentes de e-mail', icon: 'pi pi-fw pi-address-book', routerLink: ['dev/email-senders'], screen: 'dev/email-senders' },
      { label: 'Modelos de permissão', icon: 'pi pi-fw pi-bookmark', routerLink: ['settings/permissions/templates'], screen: 'settings/permissions/templates' },
      { label: 'Permissões por usuário', icon: 'pi pi-fw pi-lock', routerLink: ['settings/permissions/users'], screen: 'settings/permissions/users' },
    ],
  },
  {
    label: 'Apps Externos',
    icon: 'pi pi-fw pi-external-link',
    items: [
      { label: 'NextCloud', icon: 'pi pi-fw pi-cloud', url: 'https://cloud.proautokimium.com.br/', target: '_blank' },
      { label: 'N8N', icon: 'pi pi-fw pi-sync', url: 'https://n8n.proautokimium.com.br/', target: '_blank' },
      { label: 'PDF', icon: 'pi pi-fw pi-globe', url: 'https://pdf.proautokimium.com.br/', target: '_blank' },
      { label: 'Jenkins', icon: 'pi pi-fw pi-refresh', url: 'https://jenkins.proautokimium.com.br/', target: '_blank' },
      { label: 'Api (Documentação)', icon: 'pi pi-fw pi-server', url: 'https://api.proautokimium.com/swagger-ui/index.html', target: '_blank' },
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
/**
 * Os DESTINOS fixos da barra de baixo — três, desde 2026-09-24.
 *
 * "Apps" ocupa a terceira posição na barra e não está aqui porque não é
 * destino: ele abre a gaveta, e quem o insere é o `BottomNavComponent`.
 *
 * **Notificações saiu.** Ela estava aqui por ser a única com estado de lido, e
 * levava o ponto de não lidas no polegar. O indicador não se perdeu: o sino da
 * topbar mostra o NÚMERO, que diz mais que o ponto dizia.
 */
export const MOBILE_NAV: AppMenuItem[] = [
  { label: 'Início', icon: 'pi pi-home', routerLink: ['home'] },
  { label: 'Documentos', icon: 'pi pi-folder', routerLink: ['documentos'], screen: 'documentos' },
  { label: 'Perfil', icon: 'pi pi-user', routerLink: ['perfil'], screen: 'perfil' },
];

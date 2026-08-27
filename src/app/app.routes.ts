import { Routes } from '@angular/router';

import { PublicLayoutComponent } from './layouts/public-layout/public-layout.component';
import { AuthLayoutComponent } from './layouts/auth-layout/auth-layout.component';
import { NoHeaderLayoutComponent } from './layouts/no-header-layout/no-header-layout.component';

import { AuthGuard } from './infrastructure/guard/auth.guard';
import { PublicGuard } from './infrastructure/guard/public/public.guard';

// Páginas públicas seguem carregando junto com o app (é a vitrine do site).
import { NotFoundComponent } from './components/shared/not-found/not-found.component';
import { HomeComponent } from './components/public/home/home.component';
import { ListaProdutosComponent } from './components/public/lista-produtos/lista-produtos.component';
import { LoginComponent } from './components/public/login/login.component';
import { ClientLoginComponent } from './components/public/client-login/client-login.component';
import { InstitucionalComponent } from './components/public/institucional/institucional.component';
import { SalesCertificatesComponent } from './components/public/sales-certificates/sales-certificates.component';
import { FaqComponent } from './components/public/faq/faq.component';
import { BrandingComponent } from './components/public/branding/branding.component';
import { ForgotPasswordComponent } from './components/public/forgot-password/forgot-password.component';
import { FirstAccessComponent } from './components/public/first-access/first-access.component';
import { TrabalheConoscoComponent } from './components/public/trabalhe-conosco/trabalhe-conosco.component';
import { ViewSecretsComponent } from './components/public/view-secrets/view-secrets.component';
import { VcardComponent } from './components/public/profile/vcard/vcard.component';
import { ContatoEventosComponent } from './components/public/contato-eventos/contato-eventos.component';
import { clientGuard, clientLoggedOutGuard } from './infrastructure/guard/client.guard';

export const routes: Routes = [
  // ═══════════════════════════════════════════════════════════════════════
  // Público
  // ═══════════════════════════════════════════════════════════════════════
  {
    path: '',
    component: PublicLayoutComponent,
    canActivate: [PublicGuard],
    children: [
      { path: '', component: HomeComponent, pathMatch: 'full' },
      { path: 'produtos', component: ListaProdutosComponent, pathMatch: 'full' },
      { path: 'privacy-policy', component: InstitucionalComponent, pathMatch: 'full' },
      { path: 'sales/documents/certificates', component: SalesCertificatesComponent, pathMatch: 'full' },
      { path: 'support/faq', component: FaqComponent, pathMatch: 'full' },
      { path: 'branding', component: BrandingComponent, pathMatch: 'full' },
      { path: 'trabalhe-conosco', component: TrabalheConoscoComponent, pathMatch: 'full' },
      { path: 's/:token', component: ViewSecretsComponent, pathMatch: 'full' },
      { path: 'profile/:slug', component: VcardComponent, pathMatch: 'full' },
      { path: 'contato/eventos', component: ContatoEventosComponent, pathMatch: 'full' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Autenticado — tudo lazy (cada área baixa só quando é aberta)
  // ═══════════════════════════════════════════════════════════════════════
  {
    path: '',
    component: AuthLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },

      { path: 'home', loadComponent: () => import('./components/auth/auth-home/auth-home.component').then(m => m.AuthHomeComponent) },
      { path: 'unauthorized', loadComponent: () => import('./components/auth/access-denied/access-denied.component').then(m => m.AccessDeniedComponent) },

      // ── RH (gestão) ──────────────────────────────────────────────────────
      { path: 'rh/hub', loadComponent: () => import('./components/auth/rh/rh-hub/rh-hub.component').then(m => m.RhHubComponent), data: { screen: 'rh/hub' } },
      // Menu de ferramentas + conteúdo ao lado. A rota era o separador direto;
      // ele virou uma das ferramentas de dentro.
      { path: 'rh/holerit', loadComponent: () => import('./components/auth/documents/holerite-hub/holerite-hub.component').then(m => m.HoleriteHubComponent), data: { screen: 'rh/holerit' } },
      { path: 'rh/holerit/extractor', loadComponent: () => import('./components/auth/documents/holerit-extractor/holerit-extractor.component').then(m => m.HoleritExtractorComponent), data: { screen: 'rh/holerit/extractor' } },
      { path: 'rh/employees', loadComponent: () => import('./components/auth/partners/employes/employes.component').then(m => m.EmployesComponent), data: { screen: 'rh/employees' } },
      { path: 'rh/organizational-structure', loadComponent: () => import('./components/auth/rh/org-structure/org-structure.component').then(m => m.OrgStructureComponent), data: { screen: 'rh/organizational-structure' } },
      { path: 'rh/career-structure', loadComponent: () => import('./components/auth/rh/career-structure/career-structure.component').then(m => m.CareerStructureComponent), data: { screen: 'rh/career-structure' } },
      { path: 'rh/vacation-requests', loadComponent: () => import('./components/auth/rh/vacation-requests-manager/vacation-requests-manager.component').then(m => m.VacationRequestsManagerComponent), data: { screen: 'rh/vacation-requests' } },
      { path: 'rh/reimbursements', loadComponent: () => import('./components/auth/rh/reimbursements-manager/reimbursements-manager.component').then(m => m.ReimbursementsManagerComponent), data: { screen: 'rh/reimbursements' } },
      { path: 'rh/calendar', loadComponent: () => import('./components/auth/rh/hr-calendar/hr-calendar.component').then(m => m.HrCalendarComponent), data: { screen: 'rh/calendar' } },
      { path: 'rh/team-overview', loadComponent: () => import('./components/auth/rh/team-overview/team-overview.component').then(m => m.TeamOverviewComponent), data: { screen: 'rh/team-overview' } },
      { path: 'rh/calculators', loadComponent: () => import('./components/auth/rh/hr-calculators/hr-calculators.component').then(m => m.HrCalculatorsComponent), data: { screen: 'rh/calculators' } },
      { path: 'rh/equipment-assignments', loadComponent: () => import('./components/auth/rh/hr-equipment-assignments/hr-equipment-assignments.component').then(m => m.HrEquipmentAssignmentsComponent), data: { screen: 'rh/equipment-assignments' } },
      { path: 'rh/notifications', loadComponent: () => import('./components/auth/rh/hr-notifications/hr-notifications.component').then(m => m.HrNotificationsComponent), data: { screen: 'rh/notifications' } },
      { path: 'rh/announcements', loadComponent: () => import('./components/auth/rh/hr-announcements-manager/hr-announcements-manager.component').then(m => m.HrAnnouncementsManagerComponent), data: { screen: 'rh/announcements' } },
      { path: 'rh/medical-certificates', loadComponent: () => import('./components/auth/rh/medical-certificates-manager/medical-certificates-manager.component').then(m => m.MedicalCertificatesManagerComponent), data: { screen: 'rh/medical-certificates' } },
      { path: 'rh/painel-de-vagas', loadComponent: () => import('./components/auth/rh/painel-de-vagas/painel-de-vagas.component').then(m => m.PainelDeVagasComponent), data: { screen: 'rh/painel-de-vagas' } },
      { path: 'rh/candidaturas', loadComponent: () => import('./components/auth/rh/candidaturas/candidaturas.component').then(m => m.CandidaturasComponent), data: { screen: 'rh/candidaturas' } },

      // ── Estoque (ProStock) ───────────────────────────────────────────────
      // Mesmas funções do desktop JavaFX, que continua no ar consumindo a
      // mesma API — nenhum contrato pode mudar aqui.
      { path: 'stock/hub', loadComponent: () => import('./components/auth/stock/hub/machine-hub.component').then(m => m.MachineHubComponent), data: { screen: 'stock/hub' } },
      { path: 'stock/programacao', loadComponent: () => import('./components/auth/stock/programacao/programacao.component').then(m => m.ProgramacaoComponent), data: { screen: 'stock/programacao' } },
      { path: 'stock/inventory-hub', loadComponent: () => import('./components/auth/stock/inventory-hub/inventory-hub.component').then(m => m.InventoryHubComponent), data: { screen: 'stock/inventory-hub' } },
      // CONTRATOS entra aqui porque a tela de máquinas, que ele acessava, virou
      // esta. Sem isso, dobrar máquina dentro de produto tiraria o acesso dele.
      { path: 'stock/products', loadComponent: () => import('./components/auth/stock/products/products.component').then(m => m.ProductsComponent), data: { screen: 'stock/products' } },
      { path: 'stock/movements', loadComponent: () => import('./components/auth/stock/movements/movements.component').then(m => m.MovementsComponent), data: { screen: 'stock/movements' } },
      // Máquina virou produto marcado: o cadastro é o de produtos. O redirect
      // fica porque a rota antiga está em link salvo e no menu de quem já usava.
      { path: 'stock/machines', redirectTo: 'stock/products', pathMatch: 'full' },
      { path: 'stock/alerts', loadComponent: () => import('./components/auth/stock/alerts/machine-alerts.component').then(m => m.MachineAlertsComponent), data: { screen: 'stock/alerts' } },

      // ── Ferramentas ──────────────────────────────────────────────────────
      // Cada ferramenta é uma rota própria para abrir na sua aba, como as
      // demais telas da área de trabalho.
      { path: 'tools/pdf', loadComponent: () => import('./components/auth/tools/pdf/pdf-hub/pdf-hub.component').then(m => m.PdfHubComponent), data: { screen: 'tools/pdf' } },
      { path: 'tools/pdf/unlock', loadComponent: () => import('./components/auth/tools/pdf/pdf-unlock/pdf-unlock.component').then(m => m.PdfUnlockComponent), data: { screen: 'tools/pdf/unlock' } },
      { path: 'tools/pdf/nfse-rename', loadComponent: () => import('./components/auth/tools/pdf/pdf-nfse-rename/pdf-nfse-rename.component').then(m => m.PdfNfseRenameComponent), data: { screen: 'tools/pdf/nfse-rename' } },
      { path: 'tools/certificados', loadComponent: () => import('./components/auth/tools/certificates/certificate-batch/certificate-batch.component').then(m => m.CertificateBatchComponent), data: { screen: 'tools/certificados' } },

      // ── Empresa ──────────────────────────────────────────────────────────
      { path: 'company/nfe-collector', loadComponent: () => import('./components/auth/documents/nfe-data-collector/nfe-data-collector.component').then(m => m.NfeDataCollectorComponent), data: { screen: 'company/nfe-collector' } },
      { path: 'company/excel', loadComponent: () => import('./components/auth/documents/excel-credentials/excel-credentials.component').then(m => m.ExcelCredentialsComponent), data: { screen: 'company/excel' } },
      // As telas de estoque moram em `stock/*`. Estas duas rotas ficaram para
      // trás porque já estavam publicadas (e quebradas) — redirecionam.
      { path: 'company/products', redirectTo: 'stock/products', pathMatch: 'full' },
      { path: 'company/inventory', redirectTo: 'stock/movements', pathMatch: 'full' },
      { path: 'company/customers', loadComponent: () => import('./components/auth/partners/customer/customer.component').then(m => m.CustomerComponent), data: { screen: 'company/customers' } },
      { path: 'company/fuel-hub', loadComponent: () => import('./components/auth/company/vehicle/fuel-hub/fuel-hub.component').then(m => m.FuelHubComponent), data: { screen: 'company/fuel-hub' } },
      { path: 'company/fuel-supply', loadComponent: () => import('./components/auth/company/vehicle/fuel-supply/fuel-supply.component').then(m => m.FuelSupplyComponent), data: { screen: 'company/fuel-supply' } },
      { path: 'company/guide', loadComponent: () => import('./components/auth/guide/guide.component').then(m => m.GuideComponent), data: { screen: 'company/guide' } },
      { path: 'company/equipments', loadComponent: () => import('./components/auth/company/equipments/equipments.component').then(m => m.EquipmentsComponent), data: { screen: 'company/equipments' } },

      // ── Comunicação ──────────────────────────────────────────────────────
      { path: 'communication/newsletter', loadComponent: () => import('./components/auth/communication/newsletter/newsletter.component').then(m => m.NewsletterComponent), data: { screen: 'communication/newsletter' } },
      { path: 'communication/email', loadComponent: () => import('./components/auth/communication/email/email.component').then(m => m.EmailComponent), data: { screen: 'communication/email' } },
      { path: 'communication/secrets', loadComponent: () => import('./components/auth/communication/secrets/secrets.component').then(m => m.SecretsComponent), data: { screen: 'communication/secrets' } },
      { path: 'communication/email-signature', loadComponent: () => import('./components/auth/documents/email-signature/email-signature.component').then(m => m.EmailSignatureComponent), data: { screen: 'communication/email-signature' } },
      { path: 'communication/contact', loadComponent: () => import('./components/auth/support/contacts/contacts.component').then(m => m.ContactsComponent), data: { screen: 'communication/contact' } },

      // ── Configurações ────────────────────────────────────────────────────
      { path: 'settings/products/website', loadComponent: () => import('./components/auth/company/products/website/website.component').then(m => m.WebsiteComponent), data: { screen: 'settings/products/website' } },
      { path: 'settings/admin', loadComponent: () => import('./components/auth/admin-center/admin-center.component').then(m => m.AdminCenterComponent), data: { screen: 'settings/admin' } },
      { path: 'settings/permissions/templates', loadComponent: () => import('./components/auth/settings/permissions/templates/permission-templates.component').then(m => m.PermissionTemplatesComponent), data: { screen: 'settings/permissions/templates' } },
      { path: 'settings/permissions/users', loadComponent: () => import('./components/auth/settings/permissions/users/permission-users.component').then(m => m.PermissionUsersComponent), data: { screen: 'settings/permissions/users' } },
      { path: 'faq/manager', loadComponent: () => import('./components/auth/faq-manager/faq-manager.component').then(m => m.FaqManagerComponent), data: { screen: 'faq/manager' } },
      { path: 'profile-manager', loadComponent: () => import('./components/auth/profile/profile-manager/profile-manager.component').then(m => m.ProfileManagerComponent), data: { screen: 'profile-manager' } },

      // ── Financeiro ───────────────────────────────────────────────────────
      { path: 'finance/rent-receipt-generator', loadComponent: () => import('./components/auth/finance/rent-receipt-generator/rent-receipt-generator.component').then(m => m.RentReceiptGeneratorComponent), data: { screen: 'finance/rent-receipt-generator' } },

      // ── Documentos (área pessoal) ────────────────────────────────────────
      { path: 'documentos', loadComponent: () => import('./components/auth/documentos/documentos.component').then(m => m.DocumentosComponent), data: { screen: 'documentos' } },
      { path: 'documentos/galeria', loadComponent: () => import('./components/auth/gallery/gallery.component').then(m => m.GalleryComponent), data: { screen: 'documentos/galeria' } },
      { path: 'documentos/logos', loadComponent: () => import('./components/public/branding/branding.component').then(m => m.BrandingComponent), data: { screen: 'documentos/logos' } },
      { path: 'documentos/holerites', loadComponent: () => import('./components/auth/holerites/holerites.component').then(m => m.HoleritesComponent), data: { screen: 'documentos/holerites' } },
      { path: 'documentos/rh', loadComponent: () => import('./components/auth/hr-hub/hr-hub.component').then(m => m.HrHubComponent), data: { screen: 'documentos/rh' } },
      { path: 'documentos/rh/documents', loadComponent: () => import('./components/auth/hr-documents/hr-documents.component').then(m => m.HrDocumentsComponent), data: { screen: 'documentos/rh/documents' } },
      { path: 'documentos/rh/medical-certificates', loadComponent: () => import('./components/auth/hr-medical-certificates/hr-medical-certificates.component').then(m => m.HrMedicalCertificatesComponent), data: { screen: 'documentos/rh/medical-certificates' } },
      { path: 'documentos/rh/reimbursements', loadComponent: () => import('./components/auth/hr-reimbursements/hr-reimbursements.component').then(m => m.HrReimbursementsComponent), data: { screen: 'documentos/rh/reimbursements' } },
      { path: 'documentos/rh/vacation-requests', loadComponent: () => import('./components/auth/hr-vacation-requests/hr-vacation-requests.component').then(m => m.HrVacationRequestsComponent), data: { screen: 'documentos/rh/vacation-requests' } },
      { path: 'documentos/rh/announcements', loadComponent: () => import('./components/auth/hr-announcements/hr-announcements.component').then(m => m.HrAnnouncementsComponent), data: { screen: 'documentos/rh/announcements' } },

      { path: 'notificacoes', loadComponent: () => import('./components/auth/notificacoes/notificacoes.component').then(m => m.NotificacoesComponent) },
      { path: 'perfil', loadComponent: () => import('./components/auth/perfil/perfil.component').then(m => m.PerfilComponent), data: { screen: 'perfil' } },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Telas de entrada (sem cabeçalho do site)
  //
  // forgot-password e first-access viviam sob o PublicLayout e apareciam com o
  // header e o footer do site institucional no meio do fluxo de autenticação.
  // Agora as quatro compartilham o mesmo layout e o mesmo guard.
  // ═══════════════════════════════════════════════════════════════════════
  {
    path: '',
    component: NoHeaderLayoutComponent,
    canActivate: [PublicGuard],
    children: [
      { path: 'login', component: LoginComponent, pathMatch: 'full' },
      // Absoluto de propósito: dentro de `children`, redirectTo é resolvido
      // relativo ao pai e vai parar num lugar que não existe.
      { path: 'client-login', redirectTo: '/cliente/login', pathMatch: 'full' },
      { path: 'login/forgot-password', component: ForgotPasswordComponent, pathMatch: 'full' },
      { path: 'login/first-access', component: FirstAccessComponent, pathMatch: 'full' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Área do Cliente — sessão própria, casca própria.
  //
  // Não entra na árvore autenticada do ERP: o token é outro (`client_token`),
  // o guard é outro e o layout não tem drawer nem abas. Um funcionário logado
  // no sistema interno não deve entrar aqui por ter um token no navegador.
  // ═══════════════════════════════════════════════════════════════════════
  {
    path: 'cliente/login',
    component: NoHeaderLayoutComponent,
    canActivate: [clientLoggedOutGuard],
    children: [
      { path: '', component: ClientLoginComponent, pathMatch: 'full' },
    ],
  },
  // Entrada e recuperação de acesso. Ficam fora do `clientLoggedOutGuard` de
  // propósito: quem chega por um link de e-mail pode ter uma sessão velha no
  // navegador, e ser mandado para a dashboard em vez de definir a senha é o
  // beco sem saída que essas telas existem para resolver.
  {
    path: 'cliente/primeiro-acesso',
    component: NoHeaderLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./components/public/client-first-access/client-first-access.component').then(m => m.ClientFirstAccessComponent),
        pathMatch: 'full',
      },
    ],
  },
  {
    path: 'cliente/esqueci-senha',
    component: NoHeaderLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./components/public/client-forgot-password/client-forgot-password.component').then(m => m.ClientForgotPasswordComponent),
        pathMatch: 'full',
      },
    ],
  },
  {
    path: 'cliente/redefinir-senha',
    component: NoHeaderLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./components/public/client-reset-password/client-reset-password.component').then(m => m.ClientResetPasswordComponent),
        pathMatch: 'full',
      },
    ],
  },
  {
    path: 'cliente',
    loadComponent: () => import('./layouts/client-layout/client-layout.component').then(m => m.ClientLayoutComponent),
    canActivate: [clientGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./components/client/client-dashboard/client-dashboard.component').then(m => m.ClientDashboardComponent),
        pathMatch: 'full',
      },
    ],
  },

  // O 404 mantém o layout público, mas SEM o PublicGuard: com o guard, um usuário
  // logado que caísse aqui era devolvido para /home e entrava em loop.
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      { path: '404', component: NotFoundComponent },
    ],
  },

  { path: '**', redirectTo: '404' },
];

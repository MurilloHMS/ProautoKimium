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
      { path: 'rh/hub', loadComponent: () => import('./components/auth/rh/rh-hub/rh-hub.component').then(m => m.RhHubComponent), data: { roles: ['ADMIN', 'RH'] } },
      { path: 'rh/holerit', loadComponent: () => import('./components/auth/documents/holerit-spliter/holerit-spliter.component').then(m => m.HoleritSpliterComponent) },
      { path: 'rh/holerit/extractor', loadComponent: () => import('./components/auth/documents/holerit-extractor/holerit-extractor.component').then(m => m.HoleritExtractorComponent), data: { roles: ['ADMIN', 'RH'] } },
      { path: 'rh/employees', loadComponent: () => import('./components/auth/partners/employes/employes.component').then(m => m.EmployesComponent), data: { roles: ['ADMIN', 'RH'] } },
      { path: 'rh/organizational-structure', loadComponent: () => import('./components/auth/rh/org-structure/org-structure.component').then(m => m.OrgStructureComponent), data: { roles: ['ADMIN', 'RH'] } },
      { path: 'rh/career-structure', loadComponent: () => import('./components/auth/rh/career-structure/career-structure.component').then(m => m.CareerStructureComponent), data: { roles: ['ADMIN', 'RH'] } },
      { path: 'rh/vacation-requests', loadComponent: () => import('./components/auth/rh/vacation-requests-manager/vacation-requests-manager.component').then(m => m.VacationRequestsManagerComponent), data: { roles: ['ADMIN', 'RH'] } },
      { path: 'rh/reimbursements', loadComponent: () => import('./components/auth/rh/reimbursements-manager/reimbursements-manager.component').then(m => m.ReimbursementsManagerComponent), data: { roles: ['ADMIN', 'RH'] } },
      { path: 'rh/calendar', loadComponent: () => import('./components/auth/rh/hr-calendar/hr-calendar.component').then(m => m.HrCalendarComponent), data: { roles: ['ADMIN', 'RH'] } },
      { path: 'rh/team-overview', loadComponent: () => import('./components/auth/rh/team-overview/team-overview.component').then(m => m.TeamOverviewComponent), data: { roles: ['ADMIN', 'RH'] } },
      { path: 'rh/calculators', loadComponent: () => import('./components/auth/rh/hr-calculators/hr-calculators.component').then(m => m.HrCalculatorsComponent), data: { roles: ['ADMIN', 'RH'] } },
      { path: 'rh/equipment-assignments', loadComponent: () => import('./components/auth/rh/hr-equipment-assignments/hr-equipment-assignments.component').then(m => m.HrEquipmentAssignmentsComponent), data: { roles: ['ADMIN', 'RH'] } },
      { path: 'rh/notifications', loadComponent: () => import('./components/auth/rh/hr-notifications/hr-notifications.component').then(m => m.HrNotificationsComponent), data: { roles: ['ADMIN', 'RH'] } },
      { path: 'rh/announcements', loadComponent: () => import('./components/auth/rh/hr-announcements-manager/hr-announcements-manager.component').then(m => m.HrAnnouncementsManagerComponent), data: { roles: ['ADMIN', 'RH'] } },
      { path: 'rh/medical-certificates', loadComponent: () => import('./components/auth/rh/medical-certificates-manager/medical-certificates-manager.component').then(m => m.MedicalCertificatesManagerComponent), data: { roles: ['ADMIN', 'RH'] } },
      { path: 'rh/painel-de-vagas', loadComponent: () => import('./components/auth/rh/painel-de-vagas/painel-de-vagas.component').then(m => m.PainelDeVagasComponent), data: { roles: ['ADMIN', 'RH'] } },
      { path: 'rh/candidaturas', loadComponent: () => import('./components/auth/rh/candidaturas/candidaturas.component').then(m => m.CandidaturasComponent), data: { roles: ['ADMIN', 'RH'] } },

      // ── Estoque (ProStock) ───────────────────────────────────────────────
      // Mesmas funções do desktop JavaFX, que continua no ar consumindo a
      // mesma API — nenhum contrato pode mudar aqui.
      { path: 'stock/hub', loadComponent: () => import('./components/auth/stock/hub/machine-hub.component').then(m => m.MachineHubComponent), data: { roles: ['ADMIN', 'ALMOXARIFADO'] } },
      { path: 'stock/programacao', loadComponent: () => import('./components/auth/stock/programacao/programacao.component').then(m => m.ProgramacaoComponent), data: { roles: ['ADMIN', 'ALMOXARIFADO'] } },
      { path: 'stock/products', loadComponent: () => import('./components/auth/stock/products/products.component').then(m => m.ProductsComponent), data: { roles: ['ADMIN', 'ALMOXARIFADO'] } },
      { path: 'stock/movements', loadComponent: () => import('./components/auth/stock/movements/movements.component').then(m => m.MovementsComponent), data: { roles: ['ADMIN', 'ALMOXARIFADO'] } },
      { path: 'stock/machines', loadComponent: () => import('./components/auth/stock/machines/machines.component').then(m => m.MachinesComponent), data: { roles: ['ADMIN', 'ALMOXARIFADO'] } },
      { path: 'stock/alerts', loadComponent: () => import('./components/auth/stock/alerts/machine-alerts.component').then(m => m.MachineAlertsComponent), data: { roles: ['ADMIN', 'ALMOXARIFADO'] } },

      // ── Ferramentas ──────────────────────────────────────────────────────
      // Cada ferramenta é uma rota própria para abrir na sua aba, como as
      // demais telas da área de trabalho.
      { path: 'tools/pdf', loadComponent: () => import('./components/auth/tools/pdf/pdf-hub/pdf-hub.component').then(m => m.PdfHubComponent) },
      { path: 'tools/pdf/unlock', loadComponent: () => import('./components/auth/tools/pdf/pdf-unlock/pdf-unlock.component').then(m => m.PdfUnlockComponent) },
      { path: 'tools/pdf/nfse-rename', loadComponent: () => import('./components/auth/tools/pdf/pdf-nfse-rename/pdf-nfse-rename.component').then(m => m.PdfNfseRenameComponent) },

      // ── Empresa ──────────────────────────────────────────────────────────
      { path: 'company/nfe-collector', loadComponent: () => import('./components/auth/documents/nfe-data-collector/nfe-data-collector.component').then(m => m.NfeDataCollectorComponent), data: { roles: ['ADMIN', 'RH', 'FINANCEIRO', 'COMPRADOR'] } },
      { path: 'company/excel', loadComponent: () => import('./components/auth/documents/excel-credentials/excel-credentials.component').then(m => m.ExcelCredentialsComponent) },
      // As telas de estoque moram em `stock/*`. Estas duas rotas ficaram para
      // trás porque já estavam publicadas (e quebradas) — redirecionam.
      { path: 'company/products', redirectTo: 'stock/products', pathMatch: 'full' },
      { path: 'company/inventory', redirectTo: 'stock/movements', pathMatch: 'full' },
      { path: 'company/customers', loadComponent: () => import('./components/auth/partners/customer/customer.component').then(m => m.CustomerComponent), data: { roles: ['ADMIN', 'RH', 'MARKETING'] } },
      { path: 'company/fuel-supply', loadComponent: () => import('./components/auth/company/vehicle/fuel-supply/fuel-supply.component').then(m => m.FuelSupplyComponent), data: { roles: ['ADMIN', 'COMPRADOR'] } },
      { path: 'company/guide', loadComponent: () => import('./components/auth/guide/guide.component').then(m => m.GuideComponent), data: { roles: ['ADMIN', 'CONTRATOS'] } },
      { path: 'company/equipments', loadComponent: () => import('./components/auth/company/equipments/equipments.component').then(m => m.EquipmentsComponent), data: { roles: ['ADMIN', 'CONTRATOS', 'DESIGN'] } },

      // ── Comunicação ──────────────────────────────────────────────────────
      { path: 'communication/newsletter', loadComponent: () => import('./components/auth/communication/newsletter/newsletter.component').then(m => m.NewsletterComponent), data: { roles: ['ADMIN', 'MARKETING'] } },
      { path: 'communication/email', loadComponent: () => import('./components/auth/communication/email/email.component').then(m => m.EmailComponent), data: { roles: ['ADMIN', 'MARKETING', 'RH', 'SUPPORT', 'DESIGN'] } },
      { path: 'communication/secrets', loadComponent: () => import('./components/auth/communication/secrets/secrets.component').then(m => m.SecretsComponent), data: { roles: ['ADMIN', 'MARKETING', 'RH', 'VENDEDOR'] } },
      { path: 'communication/email-signature', loadComponent: () => import('./components/auth/documents/email-signature/email-signature.component').then(m => m.EmailSignatureComponent), data: { roles: ['ADMIN', 'RH', 'MARKETING', 'DESIGN'] } },
      { path: 'communication/contact', loadComponent: () => import('./components/auth/support/contacts/contacts.component').then(m => m.ContactsComponent), data: { roles: ['ADMIN', 'SUPPORT'] } },

      // ── Configurações ────────────────────────────────────────────────────
      { path: 'settings/products/website', loadComponent: () => import('./components/auth/company/products/website/website.component').then(m => m.WebsiteComponent), data: { roles: ['ADMIN', 'DESIGN'] } },
      { path: 'settings/admin', loadComponent: () => import('./components/auth/admin-center/admin-center.component').then(m => m.AdminCenterComponent), data: { roles: ['ADMIN'] } },
      { path: 'faq/manager', loadComponent: () => import('./components/auth/faq-manager/faq-manager.component').then(m => m.FaqManagerComponent), data: { roles: ['ADMIN'] } },
      { path: 'profile-manager', loadComponent: () => import('./components/auth/profile/profile-manager/profile-manager.component').then(m => m.ProfileManagerComponent), data: { roles: ['ADMIN'] } },

      // ── Financeiro ───────────────────────────────────────────────────────
      { path: 'finance/rent-receipt-generator', loadComponent: () => import('./components/auth/finance/rent-receipt-generator/rent-receipt-generator.component').then(m => m.RentReceiptGeneratorComponent), data: { roles: ['ADMIN', 'FINANCEIRO'] } },

      // ── Documentos (área pessoal) ────────────────────────────────────────
      { path: 'documentos', loadComponent: () => import('./components/auth/documentos/documentos.component').then(m => m.DocumentosComponent) },
      { path: 'documentos/galeria', loadComponent: () => import('./components/auth/gallery/gallery.component').then(m => m.GalleryComponent) },
      { path: 'documentos/logos', loadComponent: () => import('./components/public/branding/branding.component').then(m => m.BrandingComponent) },
      { path: 'documentos/holerites', loadComponent: () => import('./components/auth/holerites/holerites.component').then(m => m.HoleritesComponent) },
      { path: 'documentos/rh', loadComponent: () => import('./components/auth/hr-hub/hr-hub.component').then(m => m.HrHubComponent) },
      { path: 'documentos/rh/documents', loadComponent: () => import('./components/auth/hr-documents/hr-documents.component').then(m => m.HrDocumentsComponent) },
      { path: 'documentos/rh/medical-certificates', loadComponent: () => import('./components/auth/hr-medical-certificates/hr-medical-certificates.component').then(m => m.HrMedicalCertificatesComponent) },
      { path: 'documentos/rh/reimbursements', loadComponent: () => import('./components/auth/hr-reimbursements/hr-reimbursements.component').then(m => m.HrReimbursementsComponent) },
      { path: 'documentos/rh/vacation-requests', loadComponent: () => import('./components/auth/hr-vacation-requests/hr-vacation-requests.component').then(m => m.HrVacationRequestsComponent) },
      { path: 'documentos/rh/announcements', loadComponent: () => import('./components/auth/hr-announcements/hr-announcements.component').then(m => m.HrAnnouncementsComponent) },

      { path: 'notificacoes', loadComponent: () => import('./components/auth/notificacoes/notificacoes.component').then(m => m.NotificacoesComponent) },
      { path: 'perfil', loadComponent: () => import('./components/auth/perfil/perfil.component').then(m => m.PerfilComponent) },
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
      { path: 'client-login', component: ClientLoginComponent, pathMatch: 'full' },
      { path: 'login/forgot-password', component: ForgotPasswordComponent, pathMatch: 'full' },
      { path: 'login/first-access', component: FirstAccessComponent, pathMatch: 'full' },
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

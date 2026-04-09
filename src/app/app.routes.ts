import { RouterModule, Routes } from '@angular/router';
import { NgModule } from '@angular/core';
import { NotFoundComponent } from './shared/not-found/not-found.component';
import { CarrinhoComponent } from './components/public/carrinho/carrinho.component';
import { HomeComponent } from './components/public/home/home.component';
import { ListaProdutosComponent } from './components/public/lista-produtos/lista-produtos.component';
import { LoginComponent } from './components/public/login/login.component';
import { InstitucionalComponent } from './components/public/institucional/institucional.component';
import { SalesCertificatesComponent } from './components/public/sales-certificates/sales-certificates.component';
import { FaqComponent } from './components/public/faq/faq.component';
import { SellerComponent } from './components/public/profile/seller/seller.component';
import { PublicLayoutComponent } from './layouts/public-layout/public-layout.component';
import { AuthLayoutComponent } from './layouts/auth-layout/auth-layout.component';
import { AuthGuard } from './infrastructure/guard/auth.guard';
import { AdminCenterComponent } from './components/auth/admin-center/admin-center.component';
import { AuthHomeComponent } from './components/auth/auth-home/auth-home.component';
import { HoleritSpliterComponent } from './components/auth/documents/holerit-spliter/holerit-spliter.component';
import { ContactsComponent } from './components/auth/support/contacts/contacts.component';
import { NoHeaderLayoutComponent } from './layouts/no-header-layout/no-header-layout.component';
import { ProductsComponent } from './components/auth/company/products/inventory/products/products.component';
import { StockControlComponent } from './components/auth/company/products/inventory/stock-control/stock-control.component';
import { PublicGuard } from './infrastructure/guard/public/public.guard';
import { NfeDataCollectorComponent } from './components/auth/documents/nfe-data-collector/nfe-data-collector.component';
import { NewsletterComponent } from './components/auth/communication/newsletter/newsletter.component';
import { ClientLoginComponent } from './components/public/client-login/client-login.component';
import { BrandingComponent } from './components/public/branding/branding.component';
import { EmailComponent } from './components/auth/communication/email/email.component';
import { EmailSignatureComponent } from './components/auth/documents/email-signature/email-signature.component';
import { ForgotPasswordComponent } from './components/public/forgot-password/forgot-password.component';
import { HoleritExtractorComponent } from './components/auth/documents/holerit-extractor/holerit-extractor.component';
import { CustomerComponent } from './components/auth/partners/customer/customer.component';
import { EmployesComponent } from './components/auth/partners/employes/employes.component';
import { FuelSupplyComponent } from './components/auth/company/vehicle/fuel-supply/fuel-supply.component';
import { ExcelCredentialsComponent } from './components/auth/documents/excel-credentials/excel-credentials.component';
import { PainelDeVagasComponent } from './components/auth/rh/painel-de-vagas/painel-de-vagas.component';
import { CandidaturasComponent } from './components/auth/rh/candidaturas/candidaturas.component'; // 👈 novo
import { TrabalheConoscoComponent } from './components/public/trabalhe-conosco/trabalhe-conosco.component';


export const routes: Routes = [
  {
    path: '',
    component: PublicLayoutComponent,
    canActivate: [PublicGuard],
    children: [
      { path: '', component: HomeComponent, pathMatch: 'full' },
      { path: 'carrinho', component: CarrinhoComponent, pathMatch: 'full' },
      { path: 'produtos/lista', component: ListaProdutosComponent, pathMatch: 'full' },
      { path: '404', component: NotFoundComponent },
      { path: 'privacy-policy', component: InstitucionalComponent, pathMatch: 'full' },
      { path: 'sales/documents/certificates', component: SalesCertificatesComponent, pathMatch: 'full' },
      { path: 'support/faq', component: FaqComponent, pathMatch: 'full' },
      { path: 'profile', component: SellerComponent, pathMatch: 'full' },
      { path: 'branding', component: BrandingComponent, pathMatch: 'full' },
      { path: 'login/forgot-password', component: ForgotPasswordComponent, pathMatch: 'full' },
      { path: 'trabalhe-conosco', component: TrabalheConoscoComponent, pathMatch: 'full' },
    ]
  },
  {
    path: '',
    component: AuthLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: 'home', component: AuthHomeComponent, data: { roles: ['ADMIN'] } },
      { path: 'admin', component: AdminCenterComponent, data: { roles: ['ADMIN'] } },
      { path: 'documents/holerit', component: HoleritSpliterComponent, data: { roles: ['ADMIN', 'RH'] } },
      { path: 'documents/nfe-collector', component: NfeDataCollectorComponent, data: { roles: ['ADMIN', 'RH', 'FINANCEIRO', 'COMPRADOR'] } },
      { path: 'documents/email-signature', component: EmailSignatureComponent, data: { roles: ['ADMIN', 'RH', 'MARKETING', 'DESIGN', 'VENDEDOR'] } },
      { path: 'documents/holerit/extractor', component: HoleritExtractorComponent, data: { roles: ['ADMIN', 'RH'] } },
      { path: 'documents/excel', component: ExcelCredentialsComponent },
      { path: 'support/contact', component: ContactsComponent, data: { roles: ['ADMIN', 'SUPPORT'] } },
      { path: 'company/products', component: ProductsComponent, data: { roles: ['ADMIN', 'ALMOXARIFADO'] } },
      { path: 'company/inventory', component: StockControlComponent, data: { roles: ['ADMIN', 'ALMOXARIFADO'] } },
      { path: 'company/fuel-supply', component: FuelSupplyComponent, data: { roles: ['ADMIN', 'COMPRADOR'] } },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'communication/newsletter', component: NewsletterComponent, data: { roles: ['ADMIN', 'MARKETING'] } },
      { path: 'communication/email', component: EmailComponent, data: { roles: ['ADMIN', 'MARKETING', 'RH', 'SUPPORT', 'DESIGN'] } },
      { path: 'partners/customers', component: CustomerComponent, data: { roles: ['ADMIN', 'RH', 'MARKETING'] } },
      { path: 'partners/employees', component: EmployesComponent, data: { roles: ['ADMIN', 'RH', 'MARKETING'] } },
      { path: 'rh/painel-de-vagas', component: PainelDeVagasComponent, data: { roles: ['ADMIN', 'RH'] } },
      { path: 'rh/candidaturas', component: CandidaturasComponent, data: { roles: ['ADMIN', 'RH'] } },
    ]
  },
  {
    path: '',
    component: NoHeaderLayoutComponent,
    children: [
      { path: 'login', component: LoginComponent, pathMatch: 'full' },
      { path: 'client-login', component: ClientLoginComponent, pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: '404' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    scrollPositionRestoration: 'enabled',
    anchorScrolling: 'enabled'
  })],
  exports: [RouterModule],
})
export class AppRoutingModule {}

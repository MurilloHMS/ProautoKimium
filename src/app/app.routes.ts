import { RouterModule, Routes } from '@angular/router';
import { NgModule, Component } from '@angular/core';
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
import { CustomerComponent } from './components/auth/partners/customer/customer.component';
import { EmployesComponent } from './components/auth/partners/employes/employes.component';
import { ServiceLocationComponent } from './components/auth/partners/service-location/service-location.component';
import { EmailComponent } from './components/auth/settings/email/email.component';
import { ContactsComponent } from './components/auth/support/contacts/contacts.component';
import { NoHeaderLayoutComponent } from './layouts/no-header-layout/no-header-layout.component';
import { ProductsComponent } from './components/auth/company/products/inventory/products/products.component';
import { StockControlComponent } from './components/auth/company/products/inventory/stock-control/stock-control.component';
import { PublicGuard } from './infrastructure/guard/public/public.guard';
import { VehiclesComponent } from './components/auth/company/vehicle/vehicles/vehicles.component';
import { NfeDataCollectorComponent } from './components/auth/documents/nfe-data-collector/nfe-data-collector.component';
import { NewsletterComponent } from './components/auth/communication/newsletter/newsletter.component';
import { ClientLoginComponent } from './components/public/client-login/client-login.component';
import { BrandingComponent } from './components/public/branding/branding.component';


export const routes: Routes = [
    {
      path: '',
      component : PublicLayoutComponent,
      canActivate: [PublicGuard],
      children: [
        { path: '', component: HomeComponent, pathMatch: 'full'},
        { path: 'carrinho', component: CarrinhoComponent, pathMatch: 'full'},
        { path: 'produtos/lista', component: ListaProdutosComponent, pathMatch: 'full'},
        { path: '404', component: NotFoundComponent},
        { path: 'privacy-policy', component: InstitucionalComponent, pathMatch: 'full'},
        { path: 'sales/documents/certificates', component: SalesCertificatesComponent, pathMatch: 'full'},
        { path: 'support/faq', component: FaqComponent, pathMatch: 'full'},
        { path: 'profile', component: SellerComponent, pathMatch: 'full'},
        { path: 'branding', component: BrandingComponent, pathMatch: 'full'}
      ]
    },
    {
      path: '',
      component: AuthLayoutComponent,
      canActivate : [AuthGuard],
      children: [
        {path: 'home', component: AuthHomeComponent, data: {roles: ['ADMIN']}},
        {path: 'admin', component: AdminCenterComponent, data: {roles: ['ADMIN']}},
        {path: 'documents/holerit', component: HoleritSpliterComponent, data: {roles: ['ADMIN', 'RH']}},
        {path: 'documents/nfe-collector', component: NfeDataCollectorComponent, data: {roles: ['ADMIN', 'RH', 'FINANCEIRO']}},
        {path: 'partners/customers', component: CustomerComponent, data: {roles: ['ADMIN',]}},
        {path: 'partners/employees', component: EmployesComponent, data: {roles: ['ADMIN', 'RH']}},
        {path: 'partners/services-locations', component: ServiceLocationComponent, data: {roles: ['ADMIN']}},
        {path: 'settings/email', component: EmailComponent, data: {roles: ['ADMIN']}},
        {path: 'support/contact', component: ContactsComponent, data: {roles: ['ADMIN', 'SUPPORT']}},
        {path: 'company/products', component: ProductsComponent, data: {roles: ['ADMIN', 'ALMOXARIFADO']}},
        {path: 'company/inventory', component: StockControlComponent, data: {roles: ['ADMIN', 'ALMOXARIFADO']}},
        {path: 'company/vehicle', component: VehiclesComponent, data: {roles: ['ADMIN','COMPRADOR']}},
        {path: '', redirectTo: 'home', pathMatch: 'full'},
        {path: 'communication/newsletter', component: NewsletterComponent, data: {roles: ['ADMIN','MARKETING']}},
      ]
    },
    {
      path: '',
      component: NoHeaderLayoutComponent,
      children: [
        { path: 'login', component: LoginComponent, pathMatch: 'full'},
        { path: 'client-login', component: ClientLoginComponent, pathMatch: 'full'}
      ]
    },
    { path: '**', redirectTo: '404'}
];

@NgModule({
    imports: [RouterModule.forRoot(routes, {
      scrollPositionRestoration: 'enabled',
      anchorScrolling: 'enabled'
    })],
    exports: [RouterModule],
})

export class AppRoutingModule {}

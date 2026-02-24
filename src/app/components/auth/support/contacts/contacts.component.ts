import { ContactService } from './../../../../infrastructure/services/contact/contact.service';
import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Table, TableModule, TableRowExpandEvent } from 'primeng/table';
import { ToolbarModule } from 'primeng/toolbar';
import { Contact } from '../../../../domain/models/contact.model';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ConfirmDialog, ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';

@Component({
  selector: 'app-contacts',
  imports: [
    TableModule,
    CommonModule,
    ButtonModule,
    ToolbarModule,
    ButtonModule,
    FormsModule,
    TagModule,
    AvatarModule,
    TooltipModule,
    InputTextModule,
    SelectModule,
    ConfirmDialogModule,
    ToastModule
  ],
  templateUrl: './contacts.component.html',
  styleUrl: './contacts.component.scss',
  providers: [ConfirmationService, MessageService]
})
export class ContactsComponent implements OnInit{
  @ViewChild('dt1') dt1!: Table;

  contacts: Contact[] = [];
  loading = false;
  expandedRows: { [key: string]: boolean } = {};
  searchTerm = '';
  selectedType: string | null = null;

  // Substitua contactTypeOptions e os métodos getTypeSeverity e getTypeLabel

  contactTypeOptions = [
    { label: 'Dúvida sobre Produto',        value: 'DuvidaProduto' },
    { label: 'Suporte Técnico',             value: 'SuporteTecnico' },
    { label: 'Solicitação de Orçamento',    value: 'SolicitacaoOrcamento' },
    { label: 'Representação Comercial',     value: 'RepresentacaoComercial' },
    { label: 'Trabalhe Conosco',            value: 'TrabalheConosco' },
    { label: 'Consultoria Especializada',   value: 'ConsultoriaEspecializada' },
    { label: 'Visita Técnica',              value: 'VisitaTecnica' },
    { label: 'Informações sobre Certificações', value: 'InformacoesCertificacoes' },
    { label: 'Problema em Pedido/Entrega',  value: 'ProblemaPedidoEntrega' },
    { label: 'Outros',                      value: 'Outros' },
  ];


  constructor(
    private contactService: ContactService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadContacts();
  }

  loadContacts() {
    this.loading = true;
    this.contactService.getContacts().subscribe({
      next: (contacts) => {
        this.contacts = contacts;
        this.loading = false;
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar contatos' , life: 3000 });
        this.loading = false;
      }
    });
  }

  expandAll() {
    this.expandedRows = this.contacts.reduce(
      (acc, contact) => ({ ...acc, [contact.email]: true }),
      {}
    );
  }

  collapseAll() {
    this.expandedRows = {};
  }

  onRowExpand(event: TableRowExpandEvent) {  }

  onRowCollapse(event: TableRowExpandEvent) {  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  }

  getTypeLabel(type: string): string {
    return this.contactTypeOptions.find(o => o.value === type)?.label ?? type;
  }

  getTypeSeverity(type: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    const map: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'> = {
      DuvidaProduto:             'info',
      SuporteTecnico:            'warn',
      SolicitacaoOrcamento:      'success',
      RepresentacaoComercial:    'success',
      TrabalheConosco:           'contrast',
      ConsultoriaEspecializada:  'info',
      VisitaTecnica:             'info',
      InformacoesCertificacoes:  'secondary',
      ProblemaPedidoEntrega:     'danger',
      Outros:                    'secondary',
    };
    return map[type] ?? 'secondary';
  }

  isNew(contact: Contact): boolean {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    return new Date(contact.contactDate) >= oneDayAgo;
  }

  getUnreadCount(): number {
    return this.contacts.filter(c => this.isNew(c)).length;
  }

  filterByType(event: any){
    if(event.value){
      this.dt1.filter(event.value, 'contactType', 'equals');
    }else {
      this.dt1.filter(null, 'contactType', 'equals');
    }
  }

  clearSearch(){
    this.searchTerm = '';
    this.dt1.filterGlobal('', 'contains');
  }

  clearFilters(){
    this.searchTerm = '';
    this.selectedType = null;
    this.dt1.clear();
  }

  replyToContact(contact: Contact) {
    window.open(`mailto:${contact.email}?subject=Re: Seu contato&body=Olá ${contact.name},`, '_blank');
  }

  copyEmail(email: string) {
    navigator.clipboard.writeText(email).then(() => {
      this.messageService.add({
        severity: 'success',
        summary: 'Copiado!',
        detail: `${email} copiado para a área de transferência`,
        life: 2000
      });
    });
  }

  confirmDelete(contact: Contact) {
    this.confirmationService.confirm({
      message: `Deseja remover o contato de <strong>${contact.name}</strong>?`,
      header: 'Confirmar remoção',
      icon: 'pi pi-trash',
      acceptLabel: 'Sim, remover',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.contacts = this.contacts.filter(c => c.email !== contact.email);
        this.messageService.add({
          severity: 'success',
          summary: 'Removido',
          detail: `Contato de ${contact.name} removido.`,
          life: 3000
        });
      }
    });
  }

}

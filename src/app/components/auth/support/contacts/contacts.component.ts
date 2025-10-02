import { ContactService } from './../../../../infrastructure/services/contact/contact.service';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableModule, TableRowExpandEvent } from 'primeng/table';
import { ToolbarModule } from 'primeng/toolbar';
import { Contact } from '../../../../domain/models/contact.model';

@Component({
  selector: 'app-contacts',
  imports: [TableModule, CommonModule, ButtonModule, ToolbarModule],
  templateUrl: './contacts.component.html',
  styleUrl: './contacts.component.scss'
})
export class ContactsComponent {
  contacts: Contact[] = [];
  loading = false;
  expandedRows: { [key: string]: boolean } = {};

  constructor(private contactService: ContactService) {}

  loadContacts() {
    this.loading = true;
    this.contactService.getContacts().subscribe({
      next: (contacts) => {
        this.contacts = contacts;
        this.loading = false;
      },
      error: (err) => {
        alert('Erro carregando contatos: ' + err.message);
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

  onRowExpand(event: TableRowExpandEvent) {
  }

  onRowCollapse(event: TableRowExpandEvent) {
  }
}

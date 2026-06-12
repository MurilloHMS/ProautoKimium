import {Component, ContentChild, forwardRef, input, TemplateRef, ViewChild} from '@angular/core';
import {CommonModule} from "@angular/common";
import {Table, TableModule, TableService} from "primeng/table";
import {InputTextModule} from "primeng/inputtext";
import {PkInputComponent} from "../pk-input/pk-input.component";

@Component({
  selector: 'pk-table',
  imports: [
    CommonModule,
    TableModule,
    InputTextModule,
    PkInputComponent
  ],
  templateUrl: './pk-table.component.html',
  styleUrl: './pk-table.component.scss',
  providers: [
    TableService,
    {
      provide: Table,
      useFactory: (component: PkTableComponent<any>) => component.dt,
      deps: [forwardRef(() => PkTableComponent)]
    }
  ]
})
export class PkTableComponent<T> {
  data          = input<T[]>([]);
  loading       = input<boolean>(false);
  totalLabel    = input<string>('registros');
  rows          = input<number>(10);
  rowsOptions   = input<number[]>([5, 10, 20]);
  filterFields  = input<string[]>([]);
  searchPlaceholder = input<string>('Buscar…');
  emptyIcon     = input<string>('pi pi-inbox');
  emptyTitle    = input<string>('Nenhum registro encontrado');
  emptySubtitle = input<string>('');
  pageReportTitle = input<string>('Registros encontrados');

  @ViewChild('dt', { static: true }) dt!: Table;

  @ContentChild('headerTpl') headerTpl!: TemplateRef<any>;
  @ContentChild('bodyTpl') bodyTpl!: TemplateRef<any>;
}

import {Component, computed, input, Input, output} from '@angular/core';
import {ButtonModule} from "primeng/button";
import {CommonModule} from "@angular/common";
import {RippleModule} from "primeng/ripple";
import {TooltipModule} from "primeng/tooltip";

export type PkButtonType =
  | 'new'
  | 'edit'
  | 'save'
  | 'delete'
  | 'refresh'
  | 'upload'
  | 'download'
  | 'cancel'
  | 'filter'
  | 'excel';

export type PkButtonSize = 'sm' | 'md' | 'lg';

interface ButtonConfig {
  icon: string;
  label: string;
  styleClass: string;
  severity?: string;
}

const BUTTON_CONFIG: Record<PkButtonType, ButtonConfig> = {
  new:      { icon: 'pi pi-plus',        label: 'Novo',      styleClass: 'pk-btn--new'      },
  edit:     { icon: 'pi pi-pencil',      label: 'Editar',    styleClass: 'pk-btn--edit'     },
  save:     { icon: 'pi pi-check',       label: 'Salvar',    styleClass: 'pk-btn--save'     },
  delete:   { icon: 'pi pi-trash',       label: 'Excluir',   styleClass: 'pk-btn--delete'   },
  refresh:  { icon: 'pi pi-refresh',     label: '',          styleClass: 'pk-btn--refresh'  },
  upload:   { icon: 'pi pi-upload',      label: 'Importar',  styleClass: 'pk-btn--upload'   },
  download: { icon: 'pi pi-download',    label: 'Exportar',  styleClass: 'pk-btn--download' },
  cancel:   { icon: 'pi pi-times',       label: 'Cancelar',  styleClass: 'pk-btn--cancel'   },
  filter:   { icon: 'pi pi-filter',      label: 'Filtrar',   styleClass: 'pk-btn--filter'   },
  excel:    { icon: 'pi pi-file-excel',  label: '',          styleClass: 'pk-btn--excel'    },

};

@Component({
  selector: 'pk-button',
  standalone: true,
  imports: [CommonModule, ButtonModule, RippleModule, TooltipModule],
  templateUrl: './pk-button.component.html',
  styleUrl: './pk-button.component.scss',
})


export class PkButtonComponent {
  pkType    = input<PkButtonType>('new');
  pkLabel   = input<string | null>(null);
  pkSize    = input<PkButtonSize>('md');
  pkDisabled = input<boolean>(false);
  pkLoading  = input<boolean>(false);
  pkTooltip  = input<string>('');
  pkIconOnly = input<boolean>(false);

  clicked = output<MouseEvent>();

  config = computed(() => BUTTON_CONFIG[this.pkType()]);

  resolvedLabel = computed(() => {
    if (this.pkIconOnly()) return '';
    return this.pkLabel() ?? this.config().label;
  });

  resolvedIcon = computed(() =>
    this.pkLoading() ? 'pi pi-spin pi-spinner' : this.config().icon
  );

  hostClasses = computed(() => ({
    'pk-btn': true,
    [`pk-btn--${this.pkSize()}`]: true,
    [this.config().styleClass]: true,
    'pk-btn--icon-only': this.pkIconOnly(),
    'pk-btn--loading': this.pkLoading(),
  }));

  onClick(event: MouseEvent): void {
    if (!this.pkDisabled() && !this.pkLoading()) {
      this.clicked.emit(event);
    }
  }
}

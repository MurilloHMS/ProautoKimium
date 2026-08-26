import { Component, inject, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { MenuService } from '../../../infrastructure/services/menu.service';
import { AppMenuItem } from '../menu.config';

/** Navegação inferior do mobile — os destinos saem da configuração, filtrados por papel. */
@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './bottom-nav.component.html',
  styleUrl: './bottom-nav.component.scss',
})
export class BottomNavComponent {

  private readonly menuService = inject(MenuService);

  /** `computed` pelo mesmo motivo do drawer: as permissões chegam depois. */
  readonly items = computed<AppMenuItem[]>(() => this.menuService.mobileItems());
}

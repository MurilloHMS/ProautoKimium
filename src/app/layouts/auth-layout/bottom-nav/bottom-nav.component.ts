import { Component, inject } from '@angular/core';
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

  readonly items: AppMenuItem[] = this.menuService.mobileItems();
}

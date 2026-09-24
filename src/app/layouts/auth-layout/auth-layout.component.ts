import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { NotificationService } from '../../infrastructure/services/notification.service';
import { TabsService } from '../../infrastructure/services/tabs.service';
import { BottomNavComponent } from './bottom-nav/bottom-nav.component';
import { GavetaComponent } from './gaveta/gaveta.component';
import { NavDrawerComponent } from './nav-drawer/nav-drawer.component';
import { TabBarComponent } from './tab-bar/tab-bar.component';
import { TopbarComponent } from './topbar/topbar.component';
import { InstalarComponent } from '../../components/shared/instalar/instalar.component';
import { ehCelular } from '../../infrastructure/state/eh-celular';

/** Shell da área autenticada: topbar + drawer + conteúdo + bottom nav (mobile). */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [
    InstalarComponent, RouterOutlet, TopbarComponent,
    GavetaComponent, NavDrawerComponent, TabBarComponent, BottomNavComponent,
  ],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss',
})
export class AuthLayoutComponent implements OnInit, OnDestroy {

  private readonly notifications = inject(NotificationService);

  readonly tabs = inject(TabsService);

  /** O estado do drawer mora aqui: a topbar pede para abrir, o drawer pede para fechar. */
  readonly drawerOpen = signal(false);

  /**
   * Quem escolhe entre a gaveta de apps e a arvore do menu.
   *
   * A decisao e' aqui, e nao dentro de cada um: assim a gaveta nao precisa de
   * media query nenhuma, e o breakpoint continua nos tres lugares que ja
   * existem em vez de ganhar um quarto.
   */
  readonly ehCelular = ehCelular();

  ngOnInit(): void {
    this.notifications.start();
  }

  ngOnDestroy(): void {
    this.notifications.stop();
  }
}

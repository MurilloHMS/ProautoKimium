import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PrimeNG } from 'primeng/config';
import { PushNotificationService } from './infrastructure/services/push-notification.service';
import { UpdateSplashComponent } from './components/shared/update-splash/update-splash.component';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, UpdateSplashComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'proauto-kimium';

  constructor(
    private primeng: PrimeNG,
    private push: PushNotificationService
  ) {}

  ngOnInit() {
    this.primeng.ripple.set(true);

    // Clique nas notificações push abre a rota correspondente.
    this.push.initClickHandling();

    // O recarregamento por versão nova mora no `app-update-splash`: ele precisa
    // do evento para mostrar a tela, e reagir ao mesmo evento em dois lugares
    // seria recarregar antes de a tela aparecer.
  }
}

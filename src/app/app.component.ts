import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PrimeNG } from 'primeng/config';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';
import { PushNotificationService } from './infrastructure/services/push-notification.service';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'proauto-kimium';

  constructor(
    private primeng: PrimeNG,
    private swUpdate: SwUpdate,
    private push: PushNotificationService
  ) {}

  ngOnInit() {
    this.primeng.ripple.set(true);

    // Clique nas notificações push abre a rota correspondente.
    this.push.initClickHandling();

    // PWA: quando uma nova versão fica pronta, recarrega para evitar cache velho.
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates
        .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
        .subscribe(() => document.location.reload());
    }
  }
}

import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../infrastructure/services/auth.service';

/**
 * Destino do AuthGuard quando o usuário não tem o papel exigido pela rota.
 *
 * Antes o guard mandava para `/unauthorized`, que não existia: caía no `**`,
 * ia para `/404` (protegido pelo PublicGuard) e voltava para `/home` — um loop.
 */
@Component({
  selector: 'app-access-denied',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './access-denied.component.html',
  styleUrl: './access-denied.component.scss',
})
export class AccessDeniedComponent {

  private readonly auth = inject(AuthService);

  readonly roles = this.auth.getUserRoles();
}

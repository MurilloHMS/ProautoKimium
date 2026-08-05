import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-login-layout',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './login-layout.component.html',
  styleUrl: './login-layout.component.scss',
})
export class LoginLayoutComponent {
  title = input<string>('');
  subtitle = input<string>('');
  footerText = input<string>('');
  backRoute = input<string | null>(null);
  backLabel = input<string>('Voltar');
  showLogo = input<boolean>(true);
  maxWidth = input<string>('420px');
}

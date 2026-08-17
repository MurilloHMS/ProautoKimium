import { Component, input } from '@angular/core';

/**
 * Casca das telas de entrada do portal — login, primeiro acesso e recuperação
 * de senha. Todas são a mesma tela do frame `Login · Acesso`: navy de ponta a
 * ponta, discurso à esquerda, cartão de vidro à direita. Só muda o que está
 * dentro do cartão.
 *
 * Os estilos ficam em `src/styles/_client-auth.scss`, e não aqui, porque o
 * conteúdo chega por `ng-content`: CSS de componente não atravessa projeção.
 */
@Component({
  selector: 'app-client-auth-layout',
  standalone: true,
  templateUrl: './client-auth-layout.component.html',
})
export class ClientAuthLayoutComponent {

  /** Título e subtítulo do cartão — a única parte que muda entre as telas. */
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');

  /**
   * Discurso da esquerda. O padrão é o do login; as telas de senha trocam por
   * um texto que fala do que está acontecendo ali.
   */
  readonly headline = input<string>('Higiene profissional,');
  readonly headlineAccent = input<string>('controle total.');
  readonly pitch = input<string>('Acompanhe seu consumo, faturamento e manutenções — em um só lugar.');
  readonly pillars = input<string[]>([
    'Seus números do mês',
    'Histórico por unidade',
    'Horas técnicas detalhadas',
  ]);
}

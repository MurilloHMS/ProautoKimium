import {Component, Input, input} from '@angular/core';

@Component({
  selector: 'app-pk-btn-shared',
  imports: [],
  templateUrl: './pk-btn-shared.component.html',
  styleUrl: './pk-btn-shared.component.scss',
})
export class PkBtnSharedComponent {

  @Input() message: string = '';

  async shared(): Promise<void>{
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: document.title,
          text: this.message,
          url: url,
        });
      } catch (err) {
        alert('Compartilhamento cancelado');
      }
    } else {
      await this.copiarLink(url);
    }
  }

  async copiarLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      alert('Link copiado!');
    } catch {
      alert('Não foi possível copiar o link.');
    }
  }
}

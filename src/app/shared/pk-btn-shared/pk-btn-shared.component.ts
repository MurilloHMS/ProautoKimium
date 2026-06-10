import { Component } from '@angular/core';

@Component({
  selector: 'app-pk-btn-shared',
  imports: [],
  templateUrl: './pk-btn-shared.component.html',
  styleUrl: './pk-btn-shared.component.scss',
})
export class PkBtnSharedComponent {

  async shared(message: string): Promise<void>{
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: document.title,
          text: message,
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

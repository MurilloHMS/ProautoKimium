import { signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

/**
 * Base dos dados de referência compartilhados entre telas.
 *
 * Antes das abas, cada tela buscava sua própria cópia no `ngOnInit` e guardava
 * num array local. Como navegar destruía o componente, a lista sempre nascia
 * fresca e ninguém percebia o problema. Com abas, a tela fica viva e aquele
 * array congela — cadastrar um cargo numa aba não aparecia no formulário de
 * funcionário aberto na outra.
 *
 * Aqui a lista passa a ser uma só, em signal: quem cadastra chama o store, o
 * `upsert` atualiza o signal e toda tela que lê o store se atualiza sozinha.
 * Nenhum evento atravessando a aplicação.
 */
export abstract class ReferenceStore<T> {

  private readonly _items = signal<T[]>([]);
  private readonly _loading = signal(false);
  private loaded = false;

  readonly items = this._items.asReadonly();
  readonly loading = this._loading.asReadonly();

  protected abstract fetch(): Observable<T[]>;
  protected abstract idOf(item: T): string;

  /**
   * Busca a lista na primeira vez. Chamar de novo não repete a requisição —
   * é o que permite toda tela chamar `load()` no `ngOnInit` sem preocupação.
   */
  load(force = false): void {
    if (this.loaded && !force) return;

    this.loaded = true;
    this._loading.set(true);

    this.fetch().subscribe({
      next: items => {
        this._items.set(items);
        this._loading.set(false);
      },
      error: () => {
        // Falhou: destrava para a próxima tela tentar de novo.
        this.loaded = false;
        this._loading.set(false);
      },
    });
  }

  refresh(): void {
    this.load(true);
  }

  /** Marca para recarregar na próxima leitura, sem buscar agora. */
  invalidate(): void {
    this.loaded = false;
  }

  /** Insere ou substitui um item — é o que reflete o cadastro nas outras telas. */
  upsert(item: T): void {
    const id = this.idOf(item);

    this._items.update(items => {
      const index = items.findIndex(current => this.idOf(current) === id);
      if (index === -1) return [...items, item];

      const copy = [...items];
      copy[index] = item;
      return copy;
    });
  }

  remove(id: string): void {
    this._items.update(items => items.filter(item => this.idOf(item) !== id));
  }

  /** Encadeia o `upsert` na resposta de um cadastro. */
  protected withUpsert<R extends T>(source: Observable<R>): Observable<R> {
    return source.pipe(tap(item => this.upsert(item)));
  }
}

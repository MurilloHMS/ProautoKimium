import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';

import { GuideLayoutEditorComponent } from './guide-layout-editor.component';
import { GuideLayoutService } from '../../../../infrastructure/services/guide-layout.service';
import { WebsiteProductStore } from '../../../../infrastructure/state/website-product.store';
import { providersDeTeste } from '../../../../../testing/test-setup';
import { FIXTURE_CATALOG, fixtureState } from './guide-layout.fixture';
import { updateColumn } from '../../../../domain/utils/guide/layout-editor';

/**
 * O editor do layout. A regra que importa: o que se publica é o que está na
 * tela, e nada chega a Contratos sem o Publicar.
 */
describe('GuideLayoutEditorComponent', () => {

  let fixture: ComponentFixture<GuideLayoutEditorComponent>;
  let editor: GuideLayoutEditorComponent;
  let service: jasmine.SpyObj<GuideLayoutService>;
  let calls: string[];

  async function mount(withDraft = false): Promise<void> {
    calls = [];
    service = jasmine.createSpyObj<GuideLayoutService>('GuideLayoutService',
      ['state', 'catalog', 'saveDraft', 'publish', 'discardDraft', 'versions', 'restore', 'preview', 'image', 'uploadImage']);
    service.state.and.returnValue(of(fixtureState(withDraft)));
    service.catalog.and.returnValue(of(FIXTURE_CATALOG));
    service.saveDraft.and.callFake(doc => {
      calls.push('save');
      return of({ ...fixtureState(true).draft!, document: doc });
    });
    service.publish.and.callFake(() => {
      calls.push('publish');
      return of({ ...fixtureState().published, version: 4 });
    });

    await TestBed.configureTestingModule({
      imports: [GuideLayoutEditorComponent],
      providers: providersDeTeste([
        { provide: GuideLayoutService, useValue: service },
        { provide: WebsiteProductStore, useValue: { items: signal([]), loading: signal(false), load: () => {} } },
      ]),
    }).compileComponents();
    fixture = TestBed.createComponent(GuideLayoutEditorComponent);
    editor = fixture.componentInstance;
    fixture.detectChanges();
    // A carga é um `await` de duas chamadas; o whenStable sem zone não espera.
    for (let i = 0; i < 20 && editor.loading(); i++) await new Promise(r => setTimeout(r));
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function publishButton(): HTMLButtonElement {
    const host = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('pk-button'))
      .find(b => b.textContent?.includes('Publicar'))!;
    return host.querySelector('button')!;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('abre o publicado quando não há rascunho, e diz que está igual a ele', async () => {
    await mount();
    expect(text()).toContain('Igual ao publicado · v3');
    expect(editor.dirty()).toBeFalse();
    expect(publishButton().disabled).toBeTrue();
  });

  it('abre o rascunho quando há um, e permite publicar sem mexer', async () => {
    await mount(true);
    expect(text()).toContain('Rascunho salvo');
    expect(publishButton().disabled).toBeFalse();
  });

  it('coluna larga demais avisa na hora e trava o Publicar', async () => {
    await mount();
    editor.layout.set(updateColumn(editor.layout()!, 0, { width: 200 }));
    fixture.detectChanges();

    expect(text()).toContain('Alterações não salvas');
    expect(text()).toContain('passa 87 pt');
    expect(publishButton().disabled).toBeTrue();
  });

  it('salvar manda o layout da tela e deixa de estar sujo', async () => {
    await mount();
    editor.layout.set(updateColumn(editor.layout()!, 0, { title: 'ITEM' }));
    await editor.save();
    fixture.detectChanges();

    expect(service.saveDraft).toHaveBeenCalledWith(jasmine.objectContaining({
      table: jasmine.objectContaining({ columns: jasmine.arrayContaining([jasmine.objectContaining({ title: 'ITEM' })]) }),
    }));
    expect(editor.dirty()).toBeFalse();
    expect(text()).toContain('Rascunho salvo');
  });

  it('publicar com mudança não salva salva ANTES — publica o que está na tela', async () => {
    await mount();
    editor.layout.set(updateColumn(editor.layout()!, 0, { title: 'ITEM' }));
    editor.publishNote = 'troquei o título';
    await editor.publish();

    expect(calls).toEqual(['save', 'publish']);
    expect(service.publish).toHaveBeenCalledWith('troquei o título');
    expect(editor.publishedVersion()).toBe(4);
    expect(editor.hasDraft()).toBeFalse();
  });

  it('se salvar falhar, não publica', async () => {
    await mount();
    service.saveDraft.and.callFake(() => { throw new Error('rede'); });
    editor.layout.set(updateColumn(editor.layout()!, 0, { title: 'ITEM' }));
    await editor.publish();

    expect(service.publish).not.toHaveBeenCalled();
  });
});

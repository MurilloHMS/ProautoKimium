/**
 * Espelha o enum `Category` da API. HOLIDAY é o post de data comemorativa —
 * a arte que o marketing publica em rede social e que a equipe reencaminha.
 */
export type GalleryCategory = 'PRODUCT' | 'LOGO' | 'CATALOG' | 'HOLIDAY';

export interface GalleryDocument {
  id: string;
  title: string;
  description: string;
  category: GalleryCategory;
  originalFilename: string;
  contentType: string;
  createdAt: string;
}

export interface CreateGalleryDocumentDTO {
  title: string;
  description: string;
  category: GalleryCategory;
}

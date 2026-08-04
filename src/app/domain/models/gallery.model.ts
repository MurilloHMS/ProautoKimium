export type GalleryCategory = 'PRODUCT' | 'LOGO' | 'CATALOG';

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

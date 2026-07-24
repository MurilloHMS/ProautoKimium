export interface Announcement {
  id: string;
  title: string;
  content: string;
  publishedById: string;
  publishedByName: string;
  publishedAt: string;
}

export interface PublishAnnouncementPayload {
  title: string;
  content: string;
}

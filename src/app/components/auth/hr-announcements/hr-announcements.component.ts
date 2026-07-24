import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnnouncementService } from '../../../infrastructure/services/hr/announcement.service';
import { Announcement } from '../../../domain/models/hr/announcement.model';

@Component({
  selector: 'app-hr-announcements',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hr-announcements.component.html',
  styleUrl: './hr-announcements.component.scss',
})
export class HrAnnouncementsComponent implements OnInit {
  announcements = signal<Announcement[]>([]);
  loading = signal(true);
  erro = signal(false);

  constructor(private service: AnnouncementService) {}

  ngOnInit(): void {
    this.service.getAll().subscribe({
      next: (data) => {
        this.announcements.set(data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.erro.set(true);
        this.loading.set(false);
      },
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR');
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccordionModule } from 'primeng/accordion';
import { SkeletonModule } from 'primeng/skeleton';
import { FaqPublicResponseDTO } from '../../../domain/models/faq.model';
import {FaqService} from "../../../infrastructure/services/faq/faq.service";

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [CommonModule, AccordionModule, SkeletonModule],
  templateUrl: './faq.component.html',
  styleUrl: './faq.component.scss',
})
export class FaqComponent implements OnInit {
  faqs: (FaqPublicResponseDTO & { value: string })[] = [];
  loading = true;

  constructor(private faqService: FaqService) {}

  ngOnInit(): void {
    this.faqService.getAllPublic().subscribe({
      next: data => {
        this.faqs = data.map((item, i) => ({ ...item, value: String(i) }));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }
}

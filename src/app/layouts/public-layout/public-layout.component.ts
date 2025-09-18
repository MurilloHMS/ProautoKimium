import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../../layout/header/header.component';
import { FooterComponent } from '../../layout/footer/footer.component';
import { ScrollToTopComponent } from '../../shared/scroll-to-top/scroll-to-top.component';
import { WhatsappComponent } from '../../shared/whatsapp/whatsapp.component';

@Component({
    selector: 'app-public-layout',
    imports: [RouterOutlet, HeaderComponent, FooterComponent, ScrollToTopComponent, WhatsappComponent],
    templateUrl: './public-layout.component.html',
    styleUrl: './public-layout.component.scss'
})
export class PublicLayoutComponent {

}

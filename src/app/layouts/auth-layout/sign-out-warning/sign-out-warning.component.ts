import { NgTemplateOutlet } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { PkButtonComponent } from '../../../components/theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../components/theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkSheetComponent } from '../../../components/theme/ProautoKimium/pk-sheet/pk-sheet.component';
import { SignOutService } from '../../../infrastructure/services/sign-out.service';
import { ehCelular } from '../../../infrastructure/state/eh-celular';

/**
 * O aviso de "tem checklist que não foi enviado", na hora de sair. Folha de
 * baixo no celular, diálogo no computador — o mesmo corpo nas duas molduras.
 * Mora no layout, uma vez só; quem abre é o SignOutService.
 */
@Component({
  selector: 'app-sign-out-warning',
  standalone: true,
  imports: [NgTemplateOutlet, PkButtonComponent, PkDialogComponent, PkSheetComponent],
  templateUrl: './sign-out-warning.component.html',
  styleUrl: './sign-out-warning.component.scss',
})
export class SignOutWarningComponent {

  protected readonly out = inject(SignOutService);
  private readonly router = inject(Router);
  protected readonly isPhone = ehCelular();

  protected readonly title = 'Tem checklist que não foi enviado';

  /** "1 checklist" / "2 checklists". */
  protected count(n: number): string {
    return n === 1 ? '1 checklist' : `${n} checklists`;
  }

  protected openChecklists(): void {
    this.out.stay();
    void this.router.navigateByUrl('/vendas/checklist');
  }
}

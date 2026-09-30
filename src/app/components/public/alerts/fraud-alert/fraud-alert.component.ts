import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ehCelular } from '../../../../infrastructure/state/eh-celular';

/** Por quantos dias o "Estou ciente" do celular vale (pedido dele, 2026-09-30). */
export const CIENTE_POR_DIAS = 90;

@Component({
  selector: 'app-fraud-alert',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule],
  templateUrl: './fraud-alert.component.html',
  styleUrl: './fraud-alert.component.scss'
})
export class FraudAlertComponent implements OnInit {
  visible = false;

  private readonly STORAGE_KEY = 'proauto_fraud_alert_dismissed';

  /**
   * No celular, "Estou ciente" vale 90 dias: o aviso cobre a tela inteira, e
   * reaparecer a cada visita virava obstáculo para quem já leu. Guarda a DATA,
   * e não um "sim": é ela que deixa o aviso voltar sozinho depois do prazo.
   * No computador continua valendo só a sessão, como antes.
   */
  private readonly CIENTE_KEY = 'proauto_fraud_alert_ciente_em';
  private readonly isPhone = ehCelular();

  ngOnInit(): void {
    if (!this.dismissed()) {
      setTimeout(() => (this.visible = true), 400);
    }
  }

  close(): void {
    this.visible = false;
    write(sessionStorage, this.STORAGE_KEY, 'true');
    if (this.isPhone()) {
      write(localStorage, this.CIENTE_KEY, String(Date.now()));
    }
  }

  private dismissed(): boolean {
    if (read(sessionStorage, this.STORAGE_KEY)) return true;
    if (!this.isPhone()) return false;
    const since = Number(read(localStorage, this.CIENTE_KEY));
    return since > 0 && Date.now() - since < CIENTE_POR_DIAS * 86_400_000;
  }
}

// Armazenamento bloqueado (janela anônima, dados limpos) lança: aí o aviso
// simplesmente aparece, que é o lado seguro para um alerta de golpe.
function read(storage: Storage, key: string): string | null {
  try { return storage.getItem(key); } catch { return null; }
}

function write(storage: Storage, key: string, value: string): void {
  try { storage.setItem(key, value); } catch { /* sem armazenamento, o aviso volta na próxima visita */ }
}

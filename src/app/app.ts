import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme/theme.service';
import { AnaliticaService } from './core/services/analitica.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  // Fija el tema claro (identidad EscalApp); el modo oscuro fue retirado.
  private readonly theme = inject(ThemeService);

  /**
   * La analítica se arranca aquí, una sola vez para toda la app.
   *
   * `iniciar()` no hace nada en el servidor ni cuando `environment.analitica` está vacío, así
   * que esta línea es inerte hasta que existan las cuentas. Ponerla ya evita el olvido clásico:
   * crear la cuenta de GA4 y descubrir un mes después que nunca se enchufó.
   */
  private readonly analitica = inject(AnaliticaService);

  protected readonly title = signal('admin_app-v21');

  constructor() {
    this.analitica.iniciar();
  }
}

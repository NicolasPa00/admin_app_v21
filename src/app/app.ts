import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  // Fija el tema claro (identidad EscalApp); el modo oscuro fue retirado.
  private readonly theme = inject(ThemeService);
  protected readonly title = signal('admin_app-v21');
}

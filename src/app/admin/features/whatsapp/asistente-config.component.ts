import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import { Check, Loader2, Mail, Plus, X } from '../../../core/icons/phosphor';

import { AsistenteEscalappService } from '../../data-access/asistente-escalapp.service';
import { ResumenAsistenteEscalapp } from '../../models/asistente-escalapp.models';
import { ToastService } from '../../../shared/toast/toast.service';
import { CanalWhatsappComponent } from '../canal-whatsapp/canal-whatsapp.component';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * La configuración del asistente comercial: a quién avisar y desde qué sitio salen los enlaces.
 *
 * Los correos reciben UNO por cada conversación que pide un asesor (sin la ventana de 15 minutos
 * del aviso de los inquilinos), con el teléfono, los últimos mensajes y el enlace para contestar.
 */
@Component({
  selector: 'app-asistente-config',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, CanalWhatsappComponent],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({ Check, Loader2, Mail, Plus, X }),
    },
  ],
  templateUrl: './asistente-config.component.html',
  // Botones, campos e interruptores son los de Conocimiento: misma pantalla, mismo lenguaje.
  styleUrls: ['./asistente-conocimiento.component.scss', './asistente-config.component.scss'],
})
export class AsistenteConfigComponent {
  private readonly api = inject(AsistenteEscalappService);
  private readonly toast = inject(ToastService);

  readonly resumen = input<ResumenAsistenteEscalapp | null>(null);
  readonly guardado = output<void>();

  readonly correos = signal<string[]>([]);
  readonly nuevoCorreo = signal('');
  readonly urlSitio = signal('');
  readonly guardando = signal(false);

  /** Lo guardado, para saber si hay cambios. Signal: `sucio` tiene que enterarse al guardar. */
  private readonly original = signal({ correos: '', url: '' });

  /** Se rellena con lo que trae el panel, una vez por cada resumen nuevo que no pise lo escrito. */
  private readonly sembrar = effect(() => {
    const r = this.resumen();
    if (!r) return;
    untracked(() => {
      if (this.sucio()) return;
      this.correos.set([...r.config.correos_aviso]);
      this.urlSitio.set(r.config.url_sitio);
      this.original.set({ correos: r.config.correos_aviso.join(','), url: r.config.url_sitio });
    });
  });

  readonly correoValido = computed(() => EMAIL.test(this.nuevoCorreo().trim()));
  readonly sucio = computed(
    () =>
      this.correos().join(',') !== this.original().correos ||
      this.urlSitio().trim().replace(/\/+$/, '') !== this.original().url,
  );
  readonly numero = computed(() => {
    const n = this.resumen()?.numero;
    return n && n.estado === 'A' ? n.numero_e164 || 'Conectado' : null;
  });

  /** Al conectar o desconectar el número, la cabecera del panel se pone al día. */
  numeroCambio(conectado: boolean): void {
    if (conectado !== Boolean(this.numero())) this.guardado.emit();
  }

  agregarCorreo(): void {
    const c = this.nuevoCorreo().trim().toLowerCase();
    if (!EMAIL.test(c)) return;
    if (!this.correos().includes(c)) this.correos.update((l) => [...l, c]);
    this.nuevoCorreo.set('');
  }

  quitarCorreo(c: string): void {
    this.correos.update((l) => l.filter((x) => x !== c));
  }

  guardar(): void {
    if (!this.sucio() || this.guardando()) return;
    // Un correo escrito y sin pulsar «Añadir» es un correo que la persona cree haber guardado.
    if (this.correoValido()) this.agregarCorreo();
    this.guardando.set(true);
    this.api
      .guardarConfig({ correos_aviso: this.correos(), url_sitio: this.urlSitio().trim() })
      .subscribe({
        next: (c) => {
          this.guardando.set(false);
          this.original.set({ correos: c.correos_aviso.join(','), url: c.url_sitio });
          this.correos.set([...c.correos_aviso]);
          this.urlSitio.set(c.url_sitio);
          this.toast.exito(
            c.correos_aviso.length
              ? 'Guardado. Los avisos de asesor irán a esos correos.'
              : 'Guardado sin correos: nadie recibirá aviso cuando pidan un asesor.',
          );
          this.guardado.emit();
        },
        error: (err) => {
          this.guardando.set(false);
          this.toast.errorHttp(err, 'No se pudo guardar la configuración.');
        },
      });
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule, LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import {
  AlertCircle,
  BookOpen,
  Loader2,
  MessageCircle,
  Settings,
  Smartphone,
  Users,
} from '../../../core/icons/phosphor';

import { AsistenteEscalappService } from '../../data-access/asistente-escalapp.service';
import { ResumenAsistenteEscalapp } from '../../models/asistente-escalapp.models';
import { BandejaComponent } from '../bandeja/bandeja.component';
import { WhatsappInquilinosComponent } from '../whatsapp-inquilinos/whatsapp-inquilinos.component';
import { AsistenteConocimientoComponent } from './asistente-conocimiento.component';
import { AsistenteConfigComponent } from './asistente-config.component';

type Pestana = 'conversaciones' | 'conocimiento' | 'configuracion' | 'inquilinos';
const PESTANAS: readonly Pestana[] = ['conversaciones', 'conocimiento', 'configuracion', 'inquilinos'];

/**
 * WhatsappComponent — el WhatsApp de EscalApp (+57 318 033 2988), administrado desde aquí.
 *
 * ## Qué cambió el 2026-10-29
 *
 * Esta ruta era el seguimiento de los asistentes de los inquilinos. Pasó a ser el panel del
 * asistente **comercial** de EscalApp, el que atiende a quien pregunta por planes. El seguimiento
 * de los inquilinos no se perdió: es la pestaña «Inquilinos», el mismo componente de antes.
 *
 * - **Conversaciones**: la Bandeja de siempre, fijada al negocio EscalApp. Ahí se retoma un chat
 *   que el asistente pasó a un asesor, y se le devuelve al asistente al terminar.
 * - **Conocimiento**: lo que el asistente sabe y no está en la base (visitas, capacitación,
 *   promociones). Guardar es publicar: el asistente lo lee en el siguiente mensaje.
 * - **Configuración**: a quién avisar por correo cuando alguien pide un asesor.
 *
 * Planes y precios NO se editan aquí: el asistente los lee del catálogo de cobro, el mismo que
 * cobra. Una tercera copia de la tarifa sería una tercera cosa que se desfasa.
 *
 * La pestaña vive en la URL (`?tab=`), y el correo a los asesores trae `?conversacion=<id>`.
 */
@Component({
  selector: 'app-whatsapp',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    BandejaComponent,
    WhatsappInquilinosComponent,
    AsistenteConocimientoComponent,
    AsistenteConfigComponent,
  ],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        AlertCircle, BookOpen, Loader2, MessageCircle, Settings, Smartphone, Users,
      }),
    },
  ],
  templateUrl: './whatsapp.component.html',
  styleUrl: './whatsapp.component.scss',
})
export class WhatsappComponent implements OnInit {
  private readonly api = inject(AsistenteEscalappService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly _resumen = signal<ResumenAsistenteEscalapp | null>(null);
  readonly resumen = this._resumen.asReadonly();
  readonly estado = signal<'cargando' | 'listo' | 'sin-configurar' | 'error'>('cargando');

  readonly pestana = signal<Pestana>(this.pestanaDeLaUrl());
  readonly conversacionInicial = this.route.snapshot.queryParamMap.get('conversacion');

  readonly idNegocio = computed(() => this._resumen()?.negocio.id_negocio ?? null);
  readonly numero = computed(() => {
    const n = this._resumen()?.numero;
    return n && n.estado === 'A' ? n.numero_e164 || 'conectado' : null;
  });

  ngOnInit(): void {
    // En el servidor no hay sesión: la consulta fallaría y la página saldría con el error pintado.
    if (isPlatformBrowser(this.platformId)) this.cargar();
  }

  cargar(): void {
    this.estado.set('cargando');
    this.api.getResumen().subscribe({
      next: (r) => {
        this._resumen.set(r);
        this.estado.set('listo');
      },
      error: (err: HttpErrorResponse) => {
        // Base sin el negocio EscalApp: las pestañas propias no tienen sobre qué trabajar, pero
        // «Inquilinos» sí funciona, así que se ofrece en vez de dejar la pantalla en blanco.
        if (err?.status === 409) {
          this.estado.set('sin-configurar');
          if (this.pestana() !== 'inquilinos') this.verPestana('inquilinos');
          return;
        }
        this.estado.set('error');
      },
    });
  }

  /** Tras guardar en Configuración o Conocimiento, las cifras de la cabecera se ponen al día. */
  refrescarResumen(): void {
    this.api.getResumen().subscribe({ next: (r) => this._resumen.set(r), error: () => undefined });
  }

  verPestana(p: Pestana): void {
    this.pestana.set(p);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: p === 'conversaciones' ? null : p, conversacion: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private pestanaDeLaUrl(): Pestana {
    const tab = this.route.snapshot.queryParamMap.get('tab') as Pestana | null;
    return tab && PESTANAS.includes(tab) ? tab : 'conversaciones';
  }
}

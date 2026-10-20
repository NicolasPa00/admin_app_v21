import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { switchMap } from 'rxjs';

import { AyudaService } from './ayuda.service';
import { AyudaInmersionService } from './ayuda-inmersion.service';
import { CapituloTema, TemaDetalle } from './ayuda.models';
import { PROVEEDOR_ICONOS_AYUDA, iconoSeguro } from './ayuda-iconos';
import { MarkdownPipe } from './markdown.pipe';
import { textoPlano } from './markdown';
import { VideoPlayerComponent } from './video-player.component';
import { duracionLegible, marcaTiempo } from './duracion';
import { environment } from '../../environments/environment';

/**
 * La vista de un tutorial: el video, sus pasos y la guía escrita.
 *
 * Ver `admin_ws/docs/centro-de-ayuda.md`. Es la pantalla que justifica todo lo demás, y lo que
 * la hace distinta de «un video incrustado» son cuatro cosas:
 *
 *  1. **Los pasos son navegación.** Cada capítulo lleva el segundo en el que empieza; hacer clic
 *     salta ahí. Nadie tiene que arrastrar la barra buscando «la parte de la imagen».
 *  2. **El `?t=` vive en la URL.** Soporte pega el minuto exacto en un WhatsApp y al abrirlo el
 *     video arranca ahí. Si el salto fuera estado interno, el enlace no se podría compartir.
 *  3. **Cada paso tiene también texto.** Un cocinero en una cocina ruidosa no puede oír audio y
 *     un celular en 3G no puede streamear. El texto es el contenido; el video es el lujo.
 *  4. **Se pregunta si sirvió.** Los «no» agrupados por tema dicen dónde confunde el producto,
 *     que es un dato que no se consigue de ninguna otra forma.
 *
 * ## Dos zonas, y el corte está en el borde de la pantalla
 *
 * Con video, la página son dos zonas y no un artículo con cosas al lado:
 *
 *  · el **escenario** ocupa la ventana entera menos la cabecera — pasos a la izquierda en
 *    tarjetas, video grande a la derecha— porque quien abre un tutorial viene a mirar, no a leer;
 *  · la **lectura** empieza justo por debajo del pliegue: resumen, guía escrita, los pasos
 *    desarrollados, el voto y los tutoriales vecinos.
 *
 * Que la letra arranque fuera de la primera pantalla es la decisión, no un efecto: lo que se ve
 * al llegar tiene que ser la ayuda visual. Sin video no hay escenario — un recuadro negro grande
 * no ayuda a nadie— y la página vuelve a ser una guía escrita con su ancho de lectura.
 */
@Component({
  selector: 'app-ayuda-tema',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, MarkdownPipe, VideoPlayerComponent],
  providers: [...PROVEEDOR_ICONOS_AYUDA],
  templateUrl: './ayuda-tema.component.html',
  styleUrl: './ayuda-tema.component.scss',
})
export class AyudaTemaComponent {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ayuda = inject(AyudaService);
  private readonly inmersion = inject(AyudaInmersionService);
  private readonly esNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly icono = iconoSeguro;
  protected readonly marca = marcaTiempo;
  protected readonly duracion = duracionLegible;
  /** El adelanto de un paso en su tarjeta del lateral. Texto plano: se interpola, no se inyecta. */
  protected readonly adelanto = textoPlano;
  /** Para `proveedor = 'archivo'`, cuyo `embed_url` es relativo al API. */
  protected readonly apiBase = environment.ayudaApiUrl.replace(/\/ayuda$/, '');
  /** La salida a soporte humano que se ofrece tras un «no me sirvió». */
  protected readonly whatsappSoporte = environment.whatsappUrl;

  private readonly reproductor = viewChild(VideoPlayerComponent);
  private readonly escenario = viewChild<ElementRef<HTMLElement>>('escenario');
  private readonly guia = viewChild<ElementRef<HTMLElement>>('guia');

  protected readonly tema = signal<TemaDetalle | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  /** El segundo en el que va el video, para resaltar el capítulo en curso. */
  protected readonly segundoActual = signal(0);

  /** Lo que el visitante ya votó, para no volver a preguntarle. */
  protected readonly voto = signal<boolean | null>(null);

  /** El `?t=` de entrada. Se lee una vez: después manda el reproductor. */
  private readonly inicioUrl = signal(0);
  protected readonly inicioSeg = computed(() => this.inicioUrl());

  /**
   * El capítulo que se está explicando ahora.
   *
   * Se calcula como «el último que ya empezó» en vez de buscar un rango, porque los capítulos no
   * guardan final: el siguiente marca el final del anterior, y el último dura hasta que acaba el
   * video. Un modelo con `t_fin` sería un dato duplicado que se puede contradecir.
   */
  protected readonly capituloActivo = computed<number | null>(() => {
    const t = this.tema();
    const seg = this.segundoActual();
    if (!t?.capitulos.length || !t.video) return null;
    let activo: number | null = null;
    for (const cap of t.capitulos) {
      if (cap.t_inicio_seg <= seg) activo = cap.id_capitulo;
      else break;
    }
    return activo;
  });

  /** El número (1, 2, 3…) del paso en curso, para el rótulo de debajo del video. */
  protected readonly pasoActual = computed<{ numero: number; titulo: string } | null>(() => {
    const t = this.tema();
    const id = this.capituloActivo();
    if (!t || id == null) return null;
    const i = t.capitulos.findIndex((c) => c.id_capitulo === id);
    return i < 0 ? null : { numero: i + 1, titulo: t.capitulos[i].titulo };
  });

  /**
   * Si TODOS los capítulos están en el segundo 0, no son marcas de tiempo: son los pasos de una
   * guía escrita a la que todavía no se le ha grabado el video. Entonces no se pintan como
   * enlaces a un minuto, porque todos llevarían al mismo sitio y parecería que están roto.
   */
  protected readonly capitulosSonTiempos = computed(() => {
    const t = this.tema();
    if (!t?.video || !t.capitulos.length) return false;
    return t.capitulos.some((c) => c.t_inicio_seg > 0);
  });

  constructor() {
    // La cabecera del shell se oscurece solo mientras hay escenario. Se apaga al salir: si no,
    // volver al índice dejaría una cabecera oscura sobre una página clara.
    effect(() => this.inmersion.fijar(this.tema()?.video != null));
    inject(DestroyRef).onDestroy(() => this.inmersion.fijar(false));

    this.ruta.paramMap
      .pipe(
        switchMap((params) => {
          this.cargando.set(true);
          this.error.set(null);
          this.voto.set(null);
          this.segundoActual.set(0);
          // `t` es un query param, así que se lee de la instantánea en cada cambio de ruta.
          const t = Number(this.ruta.snapshot.queryParamMap.get('t') ?? 0);
          this.inicioUrl.set(Number.isFinite(t) && t > 0 ? Math.floor(t) : 0);
          return this.ayuda.getTema(
            params.get('app') ?? '',
            params.get('modulo') ?? '',
            params.get('tema') ?? '',
          );
        }),
      )
      .subscribe({
        next: (detalle) => {
          this.tema.set(detalle);
          this.segundoActual.set(this.inicioUrl());
          this.cargando.set(false);
        },
        error: (err) => {
          this.error.set(
            err?.status === 404
              ? 'Ese tutorial ya no existe o cambió de nombre.'
              : 'No pudimos cargar el tutorial. Vuelve a intentarlo en un momento.',
          );
          this.cargando.set(false);
        },
      });
  }

  /**
   * Salta al capítulo y deja la marca en la URL.
   *
   * `replaceUrl` para no llenar el historial: con seis pasos, el botón «atrás» tendría que
   * pulsarse siete veces para salir del tutorial. Y la URL se actualiza de todas formas porque
   * es lo que se copia para compartir el minuto exacto.
   *
   * `volverAlVideo` lo pasan los pasos de la guía escrita, que están debajo del pliegue: saltar
   * el video sin subir la pantalla sería mover algo que la persona no está viendo.
   */
  protected irA(cap: CapituloTema, volverAlVideo = false): void {
    this.reproductor()?.saltarA(cap.t_inicio_seg);
    this.segundoActual.set(cap.t_inicio_seg);
    if (volverAlVideo) this.desplazarA(this.escenario());

    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { t: cap.t_inicio_seg || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });

    const t = this.tema();
    if (t) {
      this.ayuda.anotar({
        tipo: 'salto_capitulo',
        id_tema: t.id_tema,
        id_capitulo: cap.id_capitulo,
        app: t.app_clave,
      });
    }
  }

  /** Baja a la guía escrita. Es el aviso de que debajo del video hay más, y cómo llegar. */
  protected irAGuia(): void {
    this.desplazarA(this.guia());
  }

  private desplazarA(destino: ElementRef<HTMLElement> | undefined): void {
    if (!this.esNavegador || !destino) return;
    // Quien pidió menos movimiento en su sistema recibe el salto seco, no la animación.
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    destino.nativeElement.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'start' });
  }

  protected alTiempo(seg: number): void {
    this.segundoActual.set(seg);
  }

  /**
   * «¿Te sirvió?».
   *
   * Un solo clic y se agradece: pedir un comentario obligatorio es garantizar que nadie vote, y
   * el conteo agrupado por tema ya dice lo que hay que saber. El comentario llegará en F3, como
   * campo opcional que aparece solo tras un «no».
   */
  protected votar(util: boolean): void {
    const t = this.tema();
    if (!t || this.voto() !== null) return;
    this.voto.set(util);
    this.ayuda.anotar({ tipo: 'voto', id_tema: t.id_tema, app: t.app_clave, util });
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { VideoTema } from './ayuda.models';

/**
 * El reproductor del Centro de ayuda — **un adaptador, no un reproductor**.
 *
 * Ver `admin_ws/docs/centro-de-ayuda.md`. Existe para que el resto de la aplicación pueda pedir
 * dos cosas sin saber dónde vive el video: «salta al segundo 135» y «¿en qué segundo vas?».
 * Hoy el alojamiento es YouTube no listado, que cuesta cero y trae CDN y calidad adaptativa; el
 * día que la marca estorbe, se cambia este archivo y `ayudaService.resolverVideo` del backend, y
 * nada más.
 *
 * Esas dos operaciones son lo que hace que los capítulos no sean decorativos:
 *   · el visitante hace clic en «Subir imagen» y el video salta ahí
 *   · el super admin le da a «marcar aquí» y la marca de tiempo se captura del propio reproductor,
 *     en vez de teclear 02:15 cuarenta veces, que es como se abandona una herramienta interna
 *
 * ## SSR
 *
 * Nada de esto corre en el servidor: el script de YouTube se carga solo en el navegador y el
 * `<div>` se queda como un hueco con la miniatura. La página del tema sí se renderiza en el
 * servidor —el texto, los capítulos, la guía escrita—, que es lo que importa para que se pueda
 * leer e indexar.
 */
@Component({
  selector: 'app-video-player',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (video(); as v) {
      @switch (v.proveedor) {
        @case ('archivo') {
          <!-- Nativo: aquí el salto es una asignación y no hace falta ningún SDK. -->
          <video
            #nativo
            class="vp-marco"
            controls
            playsinline
            preload="metadata"
            [poster]="v.miniatura ?? ''"
            [src]="apiBase + v.embed_url"
            (timeupdate)="alTiempoNativo()"
          ></video>
        }
        @default {
          <!-- El marco es el que da el tamaño y SOBREVIVE: la IFrame API de YouTube REEMPLAZA el
               nodo que se le pasa por un iframe, así que si el marco fuera ese nodo perdería su
               clase y el 16:9 se iría al suelo. Por eso el div de dentro es desechable. -->
          <div class="vp-marco">
            <div class="vp-hueco" #contenedor></div>
            @if (!listo()) {
              <div class="vp-cargando" aria-live="polite">
                @if (v.miniatura) {
                  <img [src]="v.miniatura" alt="" aria-hidden="true" />
                }
                <span>Cargando el video…</span>
              </div>
            }
          </div>
        }
      }
    }
  `,
  styles: [`
    :host { display: block; }
    .vp-marco {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      display: block;
      border: 0;
      border-radius: var(--es-radius-md, 10px);
      background: #000;
      overflow: hidden;
    }
    .vp-hueco { width: 100%; height: 100%; }
    /* ::ng-deep porque el iframe lo crea YouTube (o este componente) con la API del DOM, y a un
       nodo que Angular no compiló no se le pone el atributo del encapsulado: una regla normal
       nunca lo alcanzaría. */
    .vp-marco ::ng-deep iframe { width: 100%; height: 100%; border: 0; display: block; }
    .vp-cargando {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: #fff;
      font-size: 0.875rem;
      pointer-events: none;
    }
    .vp-cargando img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0.45;
    }
    .vp-cargando span { position: relative; z-index: 1; }
  `],
})
export class VideoPlayerComponent implements OnDestroy {
  /** El video ya resuelto por el backend. `null` = el tema es solo guía escrita. */
  readonly video = input<VideoTema | null>(null);

  /** Segundo en el que arrancar (viene del `?t=` de la URL). */
  readonly inicioSeg = input<number>(0);

  /** El segundo en el que va el video, una vez por segundo mientras reproduce. */
  readonly tiempo = output<number>();

  /** Para `proveedor = 'archivo'`: el prefijo del API, que sirve esa carpeta. */
  readonly apiBase = input<string>('');

  protected readonly listo = signal(false);

  private readonly contenedor = viewChild<ElementRef<HTMLDivElement>>('contenedor');
  private readonly nativo = viewChild<ElementRef<HTMLVideoElement>>('nativo');
  private readonly esNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  /** La instancia de `YT.Player`. `any` porque no se añade `@types/youtube` por un solo tipo. */
  private yt: any = null;
  private reloj: ReturnType<typeof setInterval> | null = null;
  /** Un salto pedido antes de que el reproductor existiera, para aplicarlo al estar listo. */
  private saltoPendiente: number | null = null;

  constructor() {
    effect(() => {
      const v = this.video();
      const caja = this.contenedor()?.nativeElement;
      if (!this.esNavegador || !v || !caja) return;
      if (v.proveedor === 'youtube') this.montarYoutube(caja, v);
      else this.montarIframe(caja, v);
    });
  }

  ngOnDestroy(): void {
    if (this.reloj) clearInterval(this.reloj);
    try {
      this.yt?.destroy?.();
    } catch {
      // Si YouTube ya se llevó el nodo por su cuenta, no hay nada que destruir.
    }
  }

  // ── La interfaz que usa el resto de la aplicación ─────────────────────────────────────────

  /**
   * Salta a un segundo del video. Es lo que hace clicable un capítulo.
   *
   * Si el reproductor aún no está listo, el salto se guarda y se aplica al estarlo: llegar a la
   * página con `?t=135` tiene que funcionar igual que hacer clic después.
   */
  saltarA(segundos: number): void {
    const seg = Math.max(0, Math.floor(segundos));

    const nativo = this.nativo()?.nativeElement;
    if (nativo) {
      nativo.currentTime = seg;
      void nativo.play().catch(() => undefined);
      return;
    }

    if (this.yt?.seekTo) {
      this.yt.seekTo(seg, true);
      this.yt.playVideo?.();
      return;
    }

    this.saltoPendiente = seg;
  }

  /**
   * El segundo en el que va el video ahora mismo. Es lo que lee «marcar aquí» del panel.
   * Devuelve 0 si no hay reproductor: un 0 es un capítulo al principio, no un fallo.
   */
  tiempoActual(): number {
    const nativo = this.nativo()?.nativeElement;
    if (nativo) return Math.floor(nativo.currentTime || 0);
    try {
      return Math.floor(this.yt?.getCurrentTime?.() ?? 0);
    } catch {
      return 0;
    }
  }

  // ── YouTube ───────────────────────────────────────────────────────────────────────────────

  private montarYoutube(caja: HTMLDivElement, v: VideoTema): void {
    if (this.yt) return;
    cargarApiYoutube().then(() => {
      const YT = (window as any).YT;
      if (!YT?.Player) return;
      this.yt = new YT.Player(caja, {
        videoId: v.ref,
        // Porcentajes y no píxeles: el iframe que crea YouTube lleva estas medidas como
        // atributos, y el 16:9 lo impone `.vp-marco`.
        width: '100%',
        height: '100%',
        playerVars: {
          // `enablejsapi` es lo que permite `seekTo`; sin él los capítulos no harían nada.
          enablejsapi: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          // Al cargar con `?t=` se arranca ya en el segundo correcto, sin un salto visible.
          start: this.inicioSeg() || 0,
          origin: window.location.origin,
        },
        // `youtube-nocookie` no pone cookies de seguimiento hasta el play: importa en una página
        // pública con política de tratamiento de datos publicada.
        host: 'https://www.youtube-nocookie.com',
        events: {
          onReady: () => {
            this.listo.set(true);
            if (this.saltoPendiente != null) {
              this.yt.seekTo(this.saltoPendiente, true);
              this.saltoPendiente = null;
            }
            this.arrancarReloj();
          },
        },
      });
    });
  }

  /**
   * Un segundo es suficiente: el reloj solo sirve para resaltar el capítulo en curso, y afinarlo
   * más sería repintar la lista cuatro veces por segundo sin que se note la diferencia.
   */
  private arrancarReloj(): void {
    if (this.reloj) return;
    this.reloj = setInterval(() => {
      const t = this.tiempoActual();
      if (t > 0) this.tiempo.emit(t);
    }, 1000);
  }

  // ── Bunny y cualquier otro iframe ─────────────────────────────────────────────────────────

  /**
   * Para Bunny no se carga ningún SDK: el salto se hace recargando el iframe con `?t=`.
   *
   * Es menos fino que `seekTo` —se reinicia la carga— y está así a propósito: hoy el proveedor es
   * YouTube, y escribir ahora la integración completa de un reproductor que no se está usando
   * sería código sin probar. Si algún día se cambia a Bunny, este es el sitio y lo dice.
   */
  private montarIframe(caja: HTMLDivElement, v: VideoTema): void {
    const inicio = this.inicioSeg() || 0;
    const sep = v.embed_url.includes('?') ? '&' : '?';
    const src = inicio ? `${v.embed_url}${sep}t=${inicio}` : v.embed_url;

    const existente = caja.querySelector('iframe');
    if (existente) {
      if (existente.getAttribute('src') !== src) existente.setAttribute('src', src);
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.setAttribute('src', src);
    iframe.setAttribute('allow', 'accelerometer; autoplay; encrypted-media; picture-in-picture');
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('title', 'Video del tutorial');
    caja.appendChild(iframe);
    this.listo.set(true);
  }

  // ── Nativo ────────────────────────────────────────────────────────────────────────────────

  protected alTiempoNativo(): void {
    const t = this.tiempoActual();
    if (t > 0) this.tiempo.emit(t);
  }
}

/**
 * Carga el script de la IFrame API una sola vez por página.
 *
 * YouTube avisa por una función global (`onYouTubeIframeAPIReady`) que se puede llamar una única
 * vez, así que con dos reproductores en la misma página —el panel tiene uno al lado del
 * formulario— el segundo nunca se enteraría. Esta promesa compartida resuelve eso: todos esperan
 * la misma carga.
 */
let promesaApi: Promise<void> | null = null;

function cargarApiYoutube(): Promise<void> {
  if (promesaApi) return promesaApi;

  promesaApi = new Promise<void>((resolve) => {
    const w = window as any;
    if (w.YT?.Player) {
      resolve();
      return;
    }

    const anterior = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      anterior?.();
      resolve();
    };

    if (!document.querySelector('script[data-yt-api]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      // Con corchetes porque `dataset` es un index signature y el proyecto compila con
      // `noPropertyAccessFromIndexSignature`.
      script.dataset['ytApi'] = '1';
      document.head.appendChild(script);
    }
  });

  return promesaApi;
}

import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toObservable } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import { EMPTY, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';

import { AyudaService } from './ayuda.service';
import { AyudaInmersionService } from './ayuda-inmersion.service';
import { ResultadoBusqueda, RespuestaBusqueda } from './ayuda.models';
import { PROVEEDOR_ICONOS_AYUDA, iconoSeguro } from './ayuda-iconos';
import { ResaltadoPipe } from './markdown.pipe';
import { marcaTiempo } from './duracion';
import { environment } from '../../environments/environment';

/**
 * El marco del Centro de ayuda: cabecera con buscador, el contenido, y el pie con la salida a
 * soporte humano.
 *
 * Ver `admin_ws/docs/centro-de-ayuda.md`.
 *
 * ## Vive FUERA de `/admin` a propósito
 *
 * `/admin/**` está detrás de `adminGuard` y en `RenderMode.Client`. Un centro de ayuda ahí no se
 * podría leer sin sesión — y la ayuda hace más falta justo cuando no se puede entrar (contraseña
 * olvidada, prueba vencida, plan caducado). Así que es pública, hermana de `/terminos` y
 * `/pagar`. El contenido no es secreto: esconder «cómo crear un producto» no protege nada.
 *
 * ## El autocompletado y el backlog de contenido
 *
 * Al teclear se piden sugerencias con `sugerir()`, que llama al buscador del backend con
 * `sugerir=true` para que **no anote** el término. Eso no es ahorro: las búsquedas sin resultado
 * son la lista de lo que hay que grabar, y anotar cada pausa al teclear la llenaría de palabras a
 * medias. Lo que sí se anota son dos cosas, y las dos son decisiones de la persona:
 *
 *   · pulsar «Buscar» → navega a `/ayuda/buscar?q=`, y esa búsqueda se anota como siempre;
 *   · quedarse quieto con un término SIN coincidencias → se repite la búsqueda, esta vez de las
 *     que cuentan. Es el caso valioso: alguien buscó algo que no existe y se rindió sin pulsar
 *     nada. Antes del autocompletado ese término llegaba porque no había más remedio que pulsar
 *     «Buscar»; ahora hay que ir a buscarlo a propósito o se perdería.
 */
@Component({
  selector: 'app-ayuda-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, FormsModule, LucideAngularModule, ResaltadoPipe],
  providers: [...PROVEEDOR_ICONOS_AYUDA],
  templateUrl: './ayuda-shell.component.html',
  styleUrl: './ayuda-shell.component.scss',
})
export class AyudaShellComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly ayuda = inject(AyudaService);

  /**
   * La cabecera se oscurece sobre el escenario del tutorial.
   *
   * Lo decide la vista del tema, no la URL: un tema sin video no tiene escenario y ahí la
   * cabecera clara es la correcta. Una franja clara pegada a un escenario oscuro es la costura
   * que delata que esto son dos pantallas cosidas, y era justo lo que se veía mal.
   */
  protected readonly inmersivo = inject(AyudaInmersionService).inmersivo;
  private readonly esNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly icono = iconoSeguro;
  protected readonly marca = marcaTiempo;

  /** El WhatsApp de soporte, para la salida del pie. */
  protected readonly whatsappSoporte = environment.whatsappUrl;

  protected readonly termino = signal('');
  /** El término sin espacios: es lo que se consulta y lo que decide si hay algo que buscar. */
  protected readonly consulta = computed(() => this.termino().trim());
  protected readonly puedeBuscar = computed(() => this.consulta().length >= 3);

  protected readonly sugerencias = signal<RespuestaBusqueda | null>(null);
  protected readonly buscando = signal(false);
  /** El panel se abre al teclear y se cierra con Escape, al salir del foco o al navegar. */
  protected readonly abierto = signal(false);
  /** Cuál está marcada con las flechas. −1 = ninguna, y entonces Enter busca en vez de abrir. */
  protected readonly activo = signal(-1);

  protected readonly visible = computed(
    () => this.abierto() && this.puedeBuscar() && (this.buscando() || this.sugerencias() !== null),
  );

  /** El temporizador del término abandonado sin coincidencias. Ver la cabecera de la clase. */
  private anotacion: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    toObservable(this.consulta)
      .pipe(
        debounceTime(220),
        distinctUntilChanged(),
        switchMap((q) => {
          this.cancelarAnotacion();
          if (q.length < 3) {
            this.sugerencias.set(null);
            this.buscando.set(false);
            this.activo.set(-1);
            return EMPTY;
          }
          this.buscando.set(true);
          // Un fallo del buscador no puede romper la cabecera de la página: se cierra el panel y
          // queda el botón «Buscar», que lleva a una pantalla que sí sabe enseñar el error.
          return this.ayuda.sugerir(q).pipe(catchError(() => of(null)));
        }),
      )
      .subscribe((res) => {
        this.buscando.set(false);
        this.sugerencias.set(res);
        this.activo.set(-1);
        if (res && res.total === 0) this.programarAnotacion(res.termino);
      });
  }

  ngOnDestroy(): void {
    this.cancelarAnotacion();
  }

  /**
   * Busca de verdad. Se navega a `/ayuda/buscar` en vez de filtrar en el sitio porque así la
   * búsqueda es una URL: se puede compartir, volver atrás y recargar. Es la misma razón por la
   * que `?t=` vive en la URL y no en un signal.
   */
  protected buscar(): void {
    const q = this.consulta();
    if (q.length < 3) return;
    // La pantalla de resultados ya anota el término; un segundo registro desde aquí contaría la
    // misma búsqueda dos veces.
    this.cancelarAnotacion();
    this.cerrar();
    void this.router.navigate(['/ayuda/buscar'], { queryParams: { q } });
  }

  /** Abre una sugerencia. La URL la armó el backend, que es de donde sale siempre. */
  protected abrirSugerencia(r: ResultadoBusqueda): void {
    this.cancelarAnotacion();
    this.cerrar();
    void this.router.navigateByUrl(r.url);
  }

  protected cerrar(): void {
    this.abierto.set(false);
    this.activo.set(-1);
  }

  protected alEscribir(valor: string): void {
    this.termino.set(valor);
    this.abierto.set(true);
  }

  /**
   * Flechas, Enter y Escape.
   *
   * Sin esto el autocompletado solo sirve con ratón, y quien escribe «crear producto» de corrido
   * tiene las manos puestas. Enter sin nada marcado hace la búsqueda completa: marcar la primera
   * sugerencia por omisión secuestraría la tecla que todo el mundo pulsa para buscar.
   */
  protected alTeclear(evento: KeyboardEvent): void {
    const lista = this.sugerencias()?.resultados ?? [];

    if (evento.key === 'Escape') {
      this.cerrar();
      return;
    }

    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      if (!lista.length) return;
      evento.preventDefault();
      this.abierto.set(true);
      const siguiente = this.activo() + (evento.key === 'ArrowDown' ? 1 : -1);
      // Da la vuelta por los dos extremos, y el −1 del medio es «ninguna»: así se vuelve al campo
      // sin perder lo escrito.
      if (siguiente >= lista.length) this.activo.set(-1);
      else if (siguiente < -1) this.activo.set(lista.length - 1);
      else this.activo.set(siguiente);
      return;
    }

    if (evento.key === 'Enter') {
      const i = this.activo();
      if (i >= 0 && lista[i]) {
        evento.preventDefault();
        this.abrirSugerencia(lista[i]);
      }
      // Con −1 no se hace nada: el `(ngSubmit)` del formulario se encarga de buscar.
    }
  }

  /** Cierra al salir del buscador, pero no al pasar de la caja a una sugerencia. */
  protected alSalirDelFoco(evento: FocusEvent): void {
    const destino = evento.relatedTarget as Node | null;
    const caja = (evento.currentTarget as HTMLElement | null) ?? null;
    if (destino && caja?.contains(destino)) return;
    this.cerrar();
  }

  /**
   * Programa el registro del término que no encontró nada.
   *
   * El segundo y medio es el punto en el que alguien dejó de escribir: antes son pausas al
   * teclear, después ya se fue. Cuesta una consulta repetida —la del término definitivo— y a
   * cambio la pestaña «Qué grabar» sigue recibiendo lo único que de verdad importa de una
   * búsqueda fallida: las palabras exactas que usó el cliente.
   */
  private programarAnotacion(q: string): void {
    this.cancelarAnotacion();
    if (!this.esNavegador || q.length < 3) return;
    this.anotacion = setTimeout(() => {
      this.anotacion = null;
      this.ayuda
        .buscar(q)
        .pipe(catchError(() => of(null)))
        .subscribe();
    }, 1500);
  }

  private cancelarAnotacion(): void {
    if (this.anotacion) {
      clearTimeout(this.anotacion);
      this.anotacion = null;
    }
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

import { AyudaAdminService } from '../../data-access/ayuda-admin.service';
import {
  AyudaAplicativoAdmin,
  AyudaMetricas,
  AyudaModuloAdmin,
  AyudaTemaAdmin,
  AyudaTemaLista,
  CapituloEnEdicion,
} from '../../models/ayuda-admin.models';
import { AyudaService } from '../../../ayuda/ayuda.service';
import { VideoPlayerComponent } from '../../../ayuda/video-player.component';
import { MarkdownPipe } from '../../../ayuda/markdown.pipe';
import { NOMBRES_ICONOS, PROVEEDOR_ICONOS_AYUDA, iconoSeguro } from '../../../ayuda/ayuda-iconos';
import { aSegundos, marcaTiempo } from '../../../ayuda/duracion';
import { environment } from '../../../../environments/environment';

type Pestania = 'contenido' | 'pendientes';

/**
 * El administrador del Centro de ayuda — solo super admin.
 *
 * Ver `admin_ws/docs/centro-de-ayuda.md`. Dos pestañas, y las dos existen por una razón distinta:
 *
 *  · **Contenido**: el árbol aplicativo → módulo → tema y el editor. Lo que de verdad decide si
 *    esta herramienta se usa o se abandona es el botón **«marcar aquí»**: captura el segundo del
 *    reproductor que está al lado, en vez de obligar a teclear `02:15` cuarenta veces.
 *  · **Pendientes**: qué grabar. Las búsquedas que no encontraron nada son peticiones de ayuda
 *    textuales de clientes reales — el backlog lo escriben ellos. Los «no me sirvió» agrupados
 *    por tema dicen dónde confunde el producto, que no se sabe de ninguna otra forma.
 *
 * El contenido es de la plataforma, el mismo para los cinco restaurantes, así que esto NO entra
 * en la matriz de permisos por negocio: lo cierra `requireSuperAdmin` en el backend y `adminGuard`
 * aquí.
 */
@Component({
  selector: 'app-ayuda-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, VideoPlayerComponent, MarkdownPipe],
  providers: [...PROVEEDOR_ICONOS_AYUDA],
  templateUrl: './ayuda-admin.component.html',
  styleUrl: './ayuda-admin.component.scss',
})
export class AyudaAdminComponent {
  private readonly api = inject(AyudaAdminService);
  private readonly ayudaPublica = inject(AyudaService);

  protected readonly icono = iconoSeguro;
  protected readonly marca = marcaTiempo;
  protected readonly iconosDisponibles = NOMBRES_ICONOS;
  protected readonly apiBase = environment.ayudaApiUrl.replace(/\/ayuda$/, '');

  private readonly reproductor = viewChild(VideoPlayerComponent);

  protected readonly pestania = signal<Pestania>('contenido');
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly aviso = signal<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  protected readonly aplicativos = signal<AyudaAplicativoAdmin[]>([]);
  protected readonly modulos = signal<AyudaModuloAdmin[]>([]);
  protected readonly temas = signal<AyudaTemaLista[]>([]);
  protected readonly metricas = signal<AyudaMetricas | null>(null);

  protected readonly idAplicativo = signal<number | null>(null);
  protected readonly idModulo = signal<number | null>(null);

  /** El tema abierto en el editor. `null` = no hay nada abierto. */
  protected readonly editando = signal<AyudaTemaAdmin | null>(null);
  /** Los capítulos en edición, aparte del tema porque es la lista que se reordena y recorta. */
  protected readonly capitulos = signal<CapituloEnEdicion[]>([]);
  /** El módulo que se está editando (crear o renombrar), aparte del editor de temas. */
  protected readonly editandoModulo = signal<Partial<AyudaModuloAdmin> | null>(null);
  /** Las rutas del módulo como texto, una por línea: es como se editan cómodo. */
  protected readonly rutasTexto = signal('');

  protected readonly modulosDelAplicativo = computed(() => {
    const id = this.idAplicativo();
    return id ? this.modulos().filter((m) => m.id_aplicativo === id) : this.modulos();
  });

  protected readonly moduloActual = computed(() =>
    this.modulos().find((m) => m.id_modulo === this.idModulo()) ?? null,
  );

  /** Vista previa del video mientras se edita, sin tener que guardar antes. */
  protected readonly videoPrevio = computed(() => {
    const t = this.editando();
    if (!t?.proveedor || !t.video_ref) return null;
    const ref = idYoutube(t.video_ref);
    if (t.proveedor === 'youtube') {
      return {
        proveedor: 'youtube' as const,
        ref,
        embed_url: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(ref)}`
          + '?enablejsapi=1&rel=0&modestbranding=1&playsinline=1',
        miniatura: t.miniatura_url
          ?? `https://i.ytimg.com/vi/${encodeURIComponent(ref)}/hqdefault.jpg`,
      };
    }
    return t.video;
  });

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);
    this.api.getAplicativos().subscribe({
      next: (apps) => {
        this.aplicativos.set(apps);
        this.api.getModulos().subscribe({
          next: (mods) => {
            this.modulos.set(mods);
            this.cargando.set(false);
          },
          error: () => this.fallo('No se pudieron cargar los módulos.'),
        });
      },
      error: () => this.fallo('No se pudo cargar el catálogo de ayuda.'),
    });
  }

  private fallo(texto: string): void {
    this.aviso.set({ tipo: 'error', texto });
    this.cargando.set(false);
  }

  // ── Navegación del árbol ──────────────────────────────────────────────────────────────────

  protected verPestania(p: Pestania): void {
    this.pestania.set(p);
    if (p === 'pendientes' && !this.metricas()) {
      this.api.getMetricas(30).subscribe({
        next: (m) => this.metricas.set(m),
        error: () => this.fallo('No se pudieron cargar las métricas.'),
      });
    }
  }

  protected elegirAplicativo(id: number): void {
    this.idAplicativo.set(id);
    this.idModulo.set(null);
    this.temas.set([]);
    this.cerrarEditor();
  }

  protected elegirModulo(id: number): void {
    this.idModulo.set(id);
    this.cerrarEditor();
    this.api.getTemas({ idModulo: id }).subscribe({
      next: (lista) => this.temas.set(lista),
      error: () => this.fallo('No se pudieron cargar los tutoriales.'),
    });
  }

  // ── Módulos ───────────────────────────────────────────────────────────────────────────────

  protected nuevoModulo(): void {
    const idApp = this.idAplicativo();
    if (!idApp) return;
    this.editandoModulo.set({
      id_aplicativo: idApp,
      clave: '',
      nombre: '',
      descripcion: '',
      icono: 'circle-help',
      orden: this.modulosDelAplicativo().length + 1,
    });
    this.rutasTexto.set('');
  }

  protected editarModulo(mod: AyudaModuloAdmin): void {
    this.editandoModulo.set({ ...mod });
    this.rutasTexto.set((mod.rutas ?? []).join('\n'));
  }

  protected guardarModulo(): void {
    const mod = this.editandoModulo();
    if (!mod) return;
    if (!mod.nombre?.trim() || !mod.clave?.trim()) {
      this.aviso.set({ tipo: 'error', texto: 'El nombre y la clave son obligatorios.' });
      return;
    }
    this.guardando.set(true);
    const cuerpo = {
      ...mod,
      // El backend normaliza barras y recorta, pero partir aquí evita mandar líneas vacías.
      rutas: this.rutasTexto().split('\n').map((r) => r.trim()).filter(Boolean),
    };
    this.api.guardarModulo(cuerpo, mod.id_modulo ?? null).subscribe({
      next: () => {
        this.guardando.set(false);
        this.editandoModulo.set(null);
        // El catálogo público está cacheado en memoria: sin esto, el cambio no se vería hasta
        // recargar la página.
        this.ayudaPublica.invalidarCatalogo();
        this.aviso.set({ tipo: 'ok', texto: 'Módulo guardado.' });
        this.cargar();
      },
      error: (err) => {
        this.guardando.set(false);
        this.aviso.set({
          tipo: 'error',
          texto: err?.error?.message ?? 'No se pudo guardar el módulo.',
        });
      },
    });
  }

  // ── Temas ─────────────────────────────────────────────────────────────────────────────────

  protected nuevoTema(): void {
    const idModulo = this.idModulo();
    if (!idModulo) return;
    this.editando.set({
      id_tema: 0,
      id_modulo: idModulo,
      clave: '',
      titulo: '',
      resumen: '',
      cuerpo: '',
      nivel: 'basico',
      proveedor: null,
      video_ref: null,
      duracion_seg: null,
      miniatura_url: null,
      palabras_clave: [],
      plan_minimo: null,
      requiere_flag: null,
      visibilidad: 'publico',
      version_grabacion: null,
      fecha_revision: null,
      orden: this.temas().length + 1,
      estado: 'A',
      modulo_clave: this.moduloActual()?.clave ?? '',
      modulo_nombre: this.moduloActual()?.nombre ?? '',
      app_clave: '',
      app_nombre: '',
      total_capitulos: 0,
      video: null,
      capitulos: [],
    });
    this.capitulos.set([]);
  }

  protected abrirTema(id: number): void {
    this.api.getTema(id).subscribe({
      next: (t) => {
        this.editando.set(t);
        this.capitulos.set(
          (t.capitulos ?? []).map((c) => ({
            id_capitulo: c.id_capitulo,
            titulo: c.titulo,
            t_inicio_seg: c.t_inicio_seg,
            cuerpo: c.cuerpo,
          })),
        );
      },
      error: () => this.fallo('No se pudo abrir el tutorial.'),
    });
  }

  protected cerrarEditor(): void {
    this.editando.set(null);
    this.capitulos.set([]);
  }

  /** Edita un campo del tema abierto. Signal inmutable: se reemplaza el objeto. */
  protected campo<K extends keyof AyudaTemaAdmin>(clave: K, valor: AyudaTemaAdmin[K]): void {
    const t = this.editando();
    if (!t) return;
    this.editando.set({ ...t, [clave]: valor });
  }

  /** Las palabras clave se escriben separadas por comas, que es como se piensan. */
  protected palabrasTexto(): string {
    return (this.editando()?.palabras_clave ?? []).join(', ');
  }

  protected setPalabras(texto: string): void {
    this.campo(
      'palabras_clave',
      texto.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean),
    );
  }

  // ── Capítulos ─────────────────────────────────────────────────────────────────────────────

  /**
   * Añade un paso con el segundo EN EL QUE VA EL VIDEO ahora mismo.
   *
   * Es la pieza que hace usable todo esto. Sin ella habría que ver el video por fuera, apuntar
   * los minutos en un papel y teclearlos uno a uno — y a la tercera vez nadie vuelve a tocar el
   * panel. Con el reproductor al lado: se pausa donde empieza el paso y se pulsa aquí.
   */
  protected marcarAqui(): void {
    const seg = this.reproductor()?.tiempoActual() ?? 0;
    this.capitulos.update((lista) => [
      ...lista,
      { titulo: '', t_inicio_seg: seg, cuerpo: '' },
    ]);
  }

  protected anadirPaso(): void {
    this.capitulos.update((lista) => [...lista, { titulo: '', t_inicio_seg: 0, cuerpo: '' }]);
  }

  protected editarPaso(i: number, cambios: Partial<CapituloEnEdicion>): void {
    this.capitulos.update((lista) =>
      lista.map((c, j) => (j === i ? { ...c, ...cambios } : c)),
    );
  }

  /** Acepta `2:15` o `135`, porque la gente escribe de las dos formas. */
  protected setTiempo(i: number, texto: string): void {
    this.editarPaso(i, { t_inicio_seg: aSegundos(texto) });
  }

  protected quitarPaso(i: number): void {
    this.capitulos.update((lista) => lista.filter((_, j) => j !== i));
  }

  protected moverPaso(i: number, delta: number): void {
    this.capitulos.update((lista) => {
      const destino = i + delta;
      if (destino < 0 || destino >= lista.length) return lista;
      const copia = [...lista];
      const [movido] = copia.splice(i, 1);
      copia.splice(destino, 0, movido);
      return copia;
    });
  }

  /** Salta el reproductor al paso, para comprobar que la marca quedó donde se quería. */
  protected probarPaso(seg: number): void {
    this.reproductor()?.saltarA(seg);
  }

  /**
   * Ordena los pasos por su marca de tiempo.
   *
   * Hace falta porque los pasos se marcan mientras se mira el video, pero también se intercalan
   * después al revisar, y un índice desordenado rompe el cálculo del «capítulo en curso» de la
   * vista pública (que da por hecho que vienen en orden).
   */
  protected ordenarPorTiempo(): void {
    this.capitulos.update((lista) =>
      [...lista].sort((a, b) => a.t_inicio_seg - b.t_inicio_seg),
    );
  }

  // ── Guardar ───────────────────────────────────────────────────────────────────────────────

  protected guardarTema(): void {
    const t = this.editando();
    if (!t) return;
    if (!t.titulo?.trim() || !t.clave?.trim()) {
      this.aviso.set({ tipo: 'error', texto: 'El título y la clave son obligatorios.' });
      return;
    }
    const pasos = this.capitulos();
    if (pasos.some((p) => !p.titulo.trim())) {
      this.aviso.set({ tipo: 'error', texto: 'Todos los pasos necesitan un título.' });
      return;
    }

    this.guardando.set(true);
    const esNuevo = !t.id_tema;
    const cuerpo: Partial<AyudaTemaAdmin> = {
      id_modulo: t.id_modulo,
      clave: t.clave.trim(),
      titulo: t.titulo.trim(),
      resumen: t.resumen,
      cuerpo: t.cuerpo,
      nivel: t.nivel,
      // El backend convierte '' en NULL y extrae el id si se pegó la URL entera de YouTube.
      proveedor: t.proveedor ?? ('' as never),
      video_ref: t.video_ref,
      duracion_seg: t.duracion_seg,
      miniatura_url: t.miniatura_url,
      palabras_clave: t.palabras_clave,
      plan_minimo: t.plan_minimo,
      requiere_flag: t.requiere_flag,
      visibilidad: t.visibilidad,
      version_grabacion: t.version_grabacion,
      fecha_revision: t.fecha_revision,
      orden: t.orden,
      capitulos: pasos as never,
    };

    this.api.guardarTema(cuerpo, esNuevo ? null : t.id_tema).subscribe({
      next: () => {
        this.guardando.set(false);
        this.ayudaPublica.invalidarCatalogo();
        this.aviso.set({ tipo: 'ok', texto: 'Tutorial guardado.' });
        this.cerrarEditor();
        const idModulo = this.idModulo();
        if (idModulo) this.elegirModulo(idModulo);
      },
      error: (err) => {
        this.guardando.set(false);
        this.aviso.set({
          tipo: 'error',
          texto: err?.error?.message ?? 'No se pudo guardar el tutorial.',
        });
      },
    });
  }

  protected cambiarEstadoTema(tema: AyudaTemaLista): void {
    const activar = tema.estado !== 'A';
    this.api.cambiarEstado('tema', tema.id_tema, activar).subscribe({
      next: () => {
        this.ayudaPublica.invalidarCatalogo();
        this.aviso.set({
          tipo: 'ok',
          texto: activar ? 'Tutorial publicado.' : 'Tutorial retirado del público.',
        });
        const idModulo = this.idModulo();
        if (idModulo) this.elegirModulo(idModulo);
      },
      error: () => this.fallo('No se pudo cambiar el estado.'),
    });
  }

  /** El enlace público del tema, para abrirlo y verlo como lo verá el cliente. */
  protected enlacePublico(tema: AyudaTemaLista): string {
    return `/ayuda/${tema.app_clave}/${tema.modulo_clave}/${tema.clave}`;
  }

  protected cerrarAviso(): void {
    this.aviso.set(null);
  }
}

/** Igual que en el backend: se pega la URL de YouTube y no el id, siempre. */
function idYoutube(valor: string): string {
  const v = String(valor).trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(v)) return v;
  const m = v.match(/(?:v=|\/embed\/|youtu\.be\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : v;
}

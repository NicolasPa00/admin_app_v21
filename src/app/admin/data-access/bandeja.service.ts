import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../auth/models/auth.models';
import {
  BandejaListado,
  ConfiguracionReactivacion,
  DiagnosticoAsistente,
  RecomendacionesAsistente,
  PreparacionAsistente,
  ConversacionBandejaDetalle,
  ReportesConversacion,
  RespuestaEncolada,
} from '../models/bandeja.models';

/**
 * BandejaService — las conversaciones del asistente, para el dueño del negocio.
 *
 * Endpoints (admin_ws), **sin** `requireSuperAdmin`:
 *   GET  /admin/intelligence/bandeja/conversaciones
 *   GET  /admin/intelligence/bandeja/conversaciones/:id
 *   POST /admin/intelligence/bandeja/conversaciones/:id/responder
 *
 * No lleva `id_negocio` a menos que el usuario elija uno: el backend decide el alcance cruzando
 * el usuario del token contra sus negocios, y **ignora** lo que mande el navegador si no es
 * suyo. Mandarlo desde aquí no da acceso a nada; omitirlo trae todos los negocios del usuario,
 * que es lo que quiere un dueño con dos locales.
 *
 * Dos respuestas del backend que esta pantalla trata como información, no como avería:
 *   · `disponible: false` — el esquema `intelligence` no está migrado en este entorno.
 *   · **409 `VENTANA_CERRADA`** — pasaron 24 h desde el último mensaje de la persona y WhatsApp
 *     ya no acepta texto libre. Se rechaza en el backend a propósito: aceptarlo sería fingir un
 *     envío que Meta iba a tirar después, sin que nadie lo viera.
 */
@Injectable({ providedIn: 'root' })
export class BandejaService {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  getConversaciones(filtros: { id_negocio?: number; solo_escaladas?: boolean } = {}):
    Observable<BandejaListado> {
    let params = new HttpParams();
    if (filtros.id_negocio) params = params.set('id_negocio', `${filtros.id_negocio}`);
    if (filtros.solo_escaladas) params = params.set('solo_escaladas', 'true');

    return this.http
      .get<ApiResponse<BandejaListado>>(`${this.API}/intelligence/bandeja/conversaciones`, {
        params,
      })
      .pipe(map((res) => res.data ?? { disponible: false, conversaciones: [], negocios: [] }));
  }

  /**
   * El archivo que mandó el cliente (foto, sticker, audio…), como `Blob`.
   *
   * Se pide con HttpClient —y no poniendo la URL en un `<img src>`— porque la ruta exige el
   * token, y un `<img>` no lo manda: así la sesión viaja por el interceptor y nunca en la URL. El
   * servidor se lo pide a Meta en el momento y no guarda copia; WhatsApp lo conserva 7 días
   * (pasado eso, 410).
   */
  archivoDeMensaje(idConversacion: string, idMensaje: string): Observable<Blob> {
    return this.http.get(
      `${this.API}/intelligence/bandeja/conversaciones/${idConversacion}/mensajes/${idMensaje}/archivo`,
      { responseType: 'blob' },
    );
  }

  /**
   * «Ya me ocupé de esto», sin escribir nada.
   *
   * No devuelve la conversación al asistente: eso lo prohíbe ADR-023 y sigue prohibido. Lo
   * único que cambia es si le queda algo por hacer a una persona.
   */
  atender(id: string): Observable<void> {
    return this.http
      .post<ApiResponse<{ escalada: boolean }>>(
        `${this.API}/intelligence/bandeja/conversaciones/${id}/atender`,
        {},
      )
      .pipe(map(() => undefined));
  }

  /**
   * «Ya terminé, que siga el asistente.»
   *
   * Es el único camino que devuelve una conversación escalada al bot, y existe por la Enmienda 1
   * de ADR-023: lo prohibido es que el bot vuelva **solo**, no que una persona se lo devuelva a
   * sabiendas. Nada automático llama aquí.
   */
  devolverAlAsistente(id: string): Observable<void> {
    return this.http
      .post<ApiResponse<{ estado: string }>>(
        `${this.API}/intelligence/bandeja/conversaciones/${id}/devolver-al-asistente`,
        {},
      )
      .pipe(map(() => undefined));
  }

  /**
   * Reporta a quien está usando el asistente para nada.
   *
   * No bloquea a nadie, no calla al asistente y no cambia el estado de la conversación: es una
   * opinión con autor, fecha y motivo. El conteo que devuelve es el del **contacto** —todas sus
   * conversaciones en este negocio—, no el de este hilo.
   *
   * Reportar dos veces la misma conversación no suma dos: la base tiene una única parcial y el
   * backend contesta 200 con el conteo real. Un clic repetido no es un segundo reporte.
   */
  reportar(id: string, motivo: string, nota?: string): Observable<ReportesConversacion | null> {
    return this.http
      .post<ApiResponse<{ reportes: ReportesConversacion }>>(
        `${this.API}/intelligence/bandeja/conversaciones/${id}/reportar`,
        { motivo, nota: nota?.trim() || undefined },
      )
      .pipe(map((res) => res.data?.reportes ?? null));
  }

  /** Deshace el reporte propio. Solo el propio: el del asistente se revisa, no se borra. */
  retirarReporte(id: string): Observable<ReportesConversacion | null> {
    return this.http
      .post<ApiResponse<{ reportes: ReportesConversacion }>>(
        `${this.API}/intelligence/bandeja/conversaciones/${id}/reportar/retirar`,
        {},
      )
      .pipe(map((res) => res.data?.reportes ?? null));
  }

  getConversacion(id: string): Observable<ConversacionBandejaDetalle | null> {
    return this.http
      .get<ApiResponse<ConversacionBandejaDetalle>>(
        `${this.API}/intelligence/bandeja/conversaciones/${id}`,
      )
      .pipe(map((res) => res.data ?? null));
  }

  /**
   * Responde a mano — y con ello **toma la conversación**: el asistente deja de contestar en
   * ella, para siempre. No es un efecto secundario del envío, es la decisión de ADR-023: si se
   * prometió una persona, contesta una persona.
   */
  responder(id: string, texto: string): Observable<RespuestaEncolada | null> {
    return this.http
      .post<ApiResponse<RespuestaEncolada>>(
        `${this.API}/intelligence/bandeja/conversaciones/${id}/responder`,
        { texto },
      )
      .pipe(map((res) => res.data ?? null));
  }

  /**
   * «Este número abusa del sistema»: le cierra la puerta al asistente sin que el cliente haya
   * escrito STOP. Distinto de una baja legal — por eso el propio negocio puede deshacerla con
   * `desbloquear`, cosa que no puede hacer con un STOP real.
   */
  bloquear(id: string, motivo?: string): Observable<{ estado: string } | null> {
    return this.http
      .post<ApiResponse<{ estado: string }>>(
        `${this.API}/intelligence/bandeja/conversaciones/${id}/bloquear`,
        motivo ? { motivo } : {},
      )
      .pipe(map((res) => res.data ?? null));
  }

  /** El reverso de `bloquear` — y solo de `bloquear`. Una baja por STOP no se deshace aquí. */
  desbloquear(id: string): Observable<{ estado: string } | null> {
    return this.http
      .post<ApiResponse<{ estado: string }>>(
        `${this.API}/intelligence/bandeja/conversaciones/${id}/desbloquear`,
        {},
      )
      .pipe(map((res) => res.data ?? null));
  }

  /** Cuándo vuelve solo el asistente en este negocio (0 = nunca) y si este usuario puede cambiarlo. */
  /** Lo que le falta al negocio para que el asistente atienda bien, con dónde se arregla. */
  getPreparacion(idNegocio: number): Observable<PreparacionAsistente | null> {
    return this.http
      .get<ApiResponse<PreparacionAsistente>>(`${this.API}/intelligence/bandeja/preparacion`, {
        params: { id_negocio: String(idNegocio) },
      })
      .pipe(map((res) => res.data ?? null));
  }

  /**
   * Pausa de emergencia del asistente (p. ej. se acabó un ingrediente): mientras dure, los
   * mensajes llegan aquí en «Esperan respuesta» y el asistente no contesta a nadie.
   */
  pausarAsistente(
    idNegocio: number,
    pausado: boolean,
  ): Observable<{ asistente_pausado: boolean; asistente_pausado_en: string | null } | null> {
    return this.http
      .post<ApiResponse<{ asistente_pausado: boolean; asistente_pausado_en: string | null }>>(
        `${this.API}/intelligence/bandeja/asistente-pausa`,
        { id_negocio: idNegocio, pausado },
      )
      .pipe(map((res) => res.data ?? null));
  }

  /**
   * Diagnóstico a fondo de la carta: reglas sobre nombres, precios y descripciones, y una prueba
   * del buscador del asistente con las formas más comunes de pedir. Bajo demanda (tarda un poco).
   */
  getDiagnostico(idNegocio: number): Observable<DiagnosticoAsistente | null> {
    return this.http
      .get<ApiResponse<DiagnosticoAsistente>>(`${this.API}/intelligence/bandeja/diagnostico`, {
        params: { id_negocio: String(idNegocio) },
      })
      .pipe(map((res) => res.data ?? null));
  }

  /**
   * Recomendaciones con IA sobre la carta: qué renombrar, separar o describir. Solo recomienda.
   * Tarda cerca de medio minuto; si la carta no cambió, devuelve el análisis anterior.
   */
  pedirRecomendaciones(idNegocio: number, forzar = false): Observable<RecomendacionesAsistente | null> {
    return this.http
      .post<ApiResponse<RecomendacionesAsistente>>(
        `${this.API}/intelligence/bandeja/diagnostico/recomendaciones`,
        { id_negocio: idNegocio, forzar },
      )
      .pipe(map((res) => res.data ?? null));
  }

  getConfiguracion(idNegocio: number): Observable<ConfiguracionReactivacion | null> {
    return this.http
      .get<ApiResponse<ConfiguracionReactivacion>>(`${this.API}/intelligence/bandeja/configuracion`, {
        params: { id_negocio: String(idNegocio) },
      })
      .pipe(map((res) => res.data ?? null));
  }

  /** Decisión explícita del negocio: exige ser administrador de ESE negocio. 0 = nunca. */
  guardarConfiguracion(idNegocio: number, minutos: number): Observable<ConfiguracionReactivacion | null> {
    return this.http
      .put<ApiResponse<ConfiguracionReactivacion>>(`${this.API}/intelligence/bandeja/configuracion`, {
        id_negocio: idNegocio,
        reactivar_asistente_min: minutos,
      })
      .pipe(map((res) => res.data ?? null));
  }

  /**
   * Información libre para el asistente (Nequi, valor del domicilio, formas de pago…).
   * `null` la borra. Exige ser administrador de ESE negocio.
   */
  guardarInfoAsistente(
    idNegocio: number,
    texto: string | null,
  ): Observable<ConfiguracionReactivacion | null> {
    return this.http
      .put<ApiResponse<ConfiguracionReactivacion>>(`${this.API}/intelligence/bandeja/configuracion`, {
        id_negocio: idNegocio,
        info_asistente: texto,
      })
      .pipe(map((res) => res.data ?? null));
  }

  /**
   * Tiempo estimado de entrega que el asistente le dice al cliente («de 40 a 60 minutos»).
   * `min = null` lo borra (y sin mínimo no hay máximo). Exige ser administrador de ESE negocio.
   */
  guardarTiempoEstimado(
    idNegocio: number,
    min: number | null,
    max: number | null,
  ): Observable<ConfiguracionReactivacion | null> {
    return this.http
      .put<ApiResponse<ConfiguracionReactivacion>>(`${this.API}/intelligence/bandeja/configuracion`, {
        id_negocio: idNegocio,
        tiempo_estimado_min: min,
        tiempo_estimado_max: min === null ? null : max,
      })
      .pipe(map((res) => res.data ?? null));
  }

  /**
   * Valor del domicilio como rango, en pesos («entre $7.000 y $9.000»), más una nota corta
   * («Fuera de la ciudad, desde $10.000»). `min = null` borra el rango (y sin mínimo no hay
   * máximo). Exige ser administrador de ESE negocio.
   */
  guardarDomicilio(
    idNegocio: number,
    min: number | null,
    max: number | null,
    nota: string | null,
  ): Observable<ConfiguracionReactivacion | null> {
    return this.http
      .put<ApiResponse<ConfiguracionReactivacion>>(`${this.API}/intelligence/bandeja/configuracion`, {
        id_negocio: idNegocio,
        domicilio_valor_min: min,
        domicilio_valor_max: min === null ? null : max,
        domicilio_nota: nota,
      })
      .pipe(map((res) => res.data ?? null));
  }
}

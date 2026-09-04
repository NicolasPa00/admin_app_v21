/**
 * Contenido de los documentos legales publicados en la landing.
 *
 * ## Dónde vive la verdad
 *
 * Los borradores de trabajo están en `admin_ws/docs/legal/` (markdown), que es donde se redacta
 * y donde van las notas para el abogado. **Este archivo es lo que ve el público.** Mientras los
 * documentos estén en borrador hay que mantener los dos en sintonía a mano; cuando el abogado
 * apruebe la versión definitiva, **esta pasa a ser la fuente de verdad** y el markdown queda como
 * histórico de la redacción.
 *
 * ## Estado: VIGENTES desde el 2026-09-03 (v1.0)
 *
 * Los datos del titular salen del **certificado de matrícula mercantil** de la Cámara de Comercio
 * de Pasto (matrícula 233177, establecimiento ESCALAPP 233178, expedido el 2026-08-28). Se publican
 * porque Meta los exige para App Review: el revisor abre estas URLs y un texto con huecos entre
 * corchetes, o un aviso de «borrador», es rechazo.
 *
 * ⚠️ **Siguen sin revisión de abogado**, y es una deuda consciente, no un olvido. En Colombia una
 * cláusula abusiva en un contrato de adhesión **se tiene por no escrita**: el riesgo de publicar
 * sin revisar no es que el documento sea ilegal, es que alguna limitación de responsabilidad no
 * proteja lo que promete. Cuando el abogado revise, sube `VERSION` y `VIGENTE_DESDE`.
 *
 * Los plazos (5 días de mora, 15 de aviso de cambios, 30 de terminación y de copia de datos, tope
 * de 3 meses de responsabilidad) son decisiones de negocio tomadas el 2026-09-03, no valores por
 * defecto de una plantilla.
 *
 * En cada cambio material: subir `VERSION` y `VIGENTE_DESDE`, y avisar a los clientes.
 *
 * ## Por qué la versión es una constante y no un texto suelto
 *
 * El día que se guarde la aceptación de cada usuario hay que guardar **qué versión aceptó**. Una
 * política aceptada que no se puede probar no sirve de nada, y «aceptó los términos» sin decir
 * cuáles no prueba gran cosa.
 */

/** Pon esto en `false` cuando el abogado apruebe el texto. Controla el aviso de la cabecera. */
export const BORRADOR = false;

/** Sube esto en cada cambio material. Es lo que hay que guardar junto a la aceptación. */
export const VERSION = '1.0';

/** Fecha de entrada en vigencia. Vacía mientras sea borrador. */
export const VIGENTE_DESDE = '3 de septiembre de 2026';

export interface SeccionLegal {
  /** Ancla para el índice y el enlace directo. */
  id: string;
  titulo: string;
  /** HTML simple: p, ul, ol, li, strong, em, table. Sin scripts ni estilos en línea. */
  html: string;
}

export interface DocumentoLegal {
  clave: 'terminos' | 'privacidad' | 'eliminacion';
  titulo: string;
  bajada: string;
  secciones: SeccionLegal[];
}

const EMPRESA = 'NICOLÁS PANTOJA PÁEZ';
const NIT = '1193035399-6';
const CONTACTO = 'nicolasppaez00@gmail.com';
/**
 * Nombre comercial: es el establecimiento de comercio (matrícula 233178), no una marca informal.
 * Va junto al nombre de la persona natural porque es lo que ata «EscalApp» al titular: quien lea
 * el certificado de Cámara de Comercio encuentra los dos nombres, y ese es el vínculo.
 */
const NOMBRE_COMERCIAL = 'ESCALAPP';
const DOMICILIO = 'CR 3 E 19 A 49, Barrio Betania, Pasto, Nariño, Colombia';
const CIUDAD = 'Pasto (Nariño)';

export const TERMINOS: DocumentoLegal = {
  clave: 'terminos',
  titulo: 'Términos y Condiciones',
  bajada: 'Las reglas del servicio, en el orden en que suelen importar.',
  secciones: [
    {
      id: 'quienes-somos',
      titulo: '1. Quiénes somos y qué aceptas',
      html: `
        <p>Este documento regula el uso de <strong>EscalApp</strong>, una plataforma de software en
        la nube para la gestión de negocios, prestada por <strong>${EMPRESA}</strong>, persona
        natural comerciante identificada con NIT <strong>${NIT}</strong>, que ejerce su actividad a
        través del establecimiento de comercio <strong>${NOMBRE_COMERCIAL}</strong> (matrícula
        mercantil 233178 de la Cámara de Comercio de Pasto), con domicilio en ${DOMICILIO}.</p>
        <p>Al crear una cuenta, contratar un plan o usar la plataforma, el negocio y las personas
        que actúan en su nombre aceptan estos términos en su totalidad. Si no estás de acuerdo, no
        uses el servicio.</p>
        <p>Estos términos se complementan con la <strong>Política de Tratamiento de Datos
        Personales</strong> y con el <strong>Anexo de Encargado del Tratamiento</strong>. Los tres
        forman un solo acuerdo.</p>`,
    },
    {
      id: 'servicio',
      titulo: '2. Qué te damos',
      html: `
        <p>EscalApp te concede un derecho <strong>no exclusivo, intransferible y revocable</strong>
        a usar la plataforma según el plan contratado, mientras el contrato esté vigente y al día.</p>
        <p>Según el plan y el tipo de negocio, la plataforma incluye gestión de ventas y pedidos,
        caja, inventario, agenda y citas, reportes, asistente conversacional por WhatsApp y
        —cuando lo actives y cumplas los requisitos— facturación electrónica.</p>
        <p><strong>No se transfiere ninguna propiedad sobre el software.</strong> El código, la
        marca, el diseño y la documentación son y siguen siendo de EscalApp.</p>`,
    },
    {
      id: 'cuenta',
      titulo: '3. Tu cuenta',
      html: `
        <p>Eres responsable de la veracidad de los datos que registras y de custodiar tus
        credenciales y las de los usuarios que crees. <strong>Todo lo que ocurra desde una cuenta
        se entiende hecho por su titular.</strong></p>
        <p>Avísanos de inmediato si sospechas un uso no autorizado, y asegúrate de que tus usuarios
        cumplan estos términos.</p>`,
    },
    {
      id: 'precios',
      titulo: '4. Planes, precios y pagos',
      html: `
        <p>Los planes vigentes y sus precios se publican en escalapp.cloud. El cobro es
        <strong>mensual y anticipado</strong>, salvo pacto distinto por escrito.</p>
        <p>A la fecha de esta versión, <strong>EscalApp no es responsable de IVA</strong>, por lo
        que los precios no lo incluyen ni lo discriminan. Si esa condición cambia, te avisaremos
        con al menos 30 días de antelación y el precio se ajustará según la ley.</p>
        <p>EscalApp expedirá la factura correspondiente a tu nombre, con los datos fiscales que tú
        mismo hayas suministrado.</p>
        <p><strong>Mora:</strong> si el pago se retrasa más de 5 días, podemos suspender el
        acceso previo aviso al correo registrado. La suspensión no borra tus datos.</p>`,
    },
    {
      id: 'prueba',
      titulo: '5. Períodos de prueba',
      html: `
        <p>El período de prueba es <strong>gratuito, temporal y sin obligación de continuar</strong>.
        Al terminar, si no contratas un plan, la cuenta puede suspenderse. Tus datos se conservan
        durante el plazo indicado en la sección 12 antes de eliminarse.</p>`,
    },
    {
      id: 'declaraciones',
      titulo: '6. Lo que tú declaras',
      html: `
        <p>Declaras que la información que registras es <strong>veraz, completa y actual</strong>, y
        te obligas a mantenerla actualizada. Esto incluye:</p>
        <ul>
          <li>Si tu negocio está <strong>inscrito en la Cámara de Comercio</strong> y tiene
          <strong>RUT</strong>.</li>
          <li>Si actúas como <strong>persona natural o persona jurídica</strong>.</li>
          <li>Tu razón social, NIT o documento de identificación y su dígito de verificación.</li>
          <li>Tu régimen tributario, responsabilidades fiscales y los tributos que causas.</li>
          <li>Si estás <strong>obligado a facturar</strong> electrónicamente.</li>
          <li>Los datos de tu resolución de numeración de facturación, cuando aplique.</li>
        </ul>
        <p><strong>EscalApp no verifica esta información ante la Cámara de Comercio, la DIAN ni
        ninguna otra entidad</strong>, y no está en posición ni en obligación de hacerlo. La
        plataforma se limita a registrar lo que declaras, dejando constancia del usuario que lo
        declaró y de la fecha.</p>
        <p><strong>Las consecuencias de una declaración inexacta, incompleta o desactualizada son
        exclusivamente tuyas</strong>, incluidas las sanciones, intereses o rechazos que impongan
        las autoridades.</p>`,
    },
    {
      id: 'facturacion',
      titulo: '7. Facturación electrónica',
      html: `
        <p>Cuando actives la facturación electrónica:</p>
        <ul>
          <li><strong>El obligado a facturar eres tú, no EscalApp.</strong> EscalApp no es proveedor
          tecnológico habilitado por la DIAN ni asesor tributario o contable: es una herramienta
          que transmite la información a través de un proveedor habilitado, por tu cuenta e
          instrucción.</li>
          <li><strong>Es tu responsabilidad</strong> obtener tu habilitación ante la DIAN, mantener
          vigente tu resolución de numeración, determinar con tu contador si estás obligado a
          facturar y qué impuestos aplican a tus productos, y revisar los documentos emitidos.</li>
          <li><strong>La emisión depende de terceros</strong>: del proveedor tecnológico y de los
          servicios de la DIAN. Cuando alguno no esté disponible, la venta se registra igualmente y
          el documento queda en cola para transmitirse después.</li>
          <li>EscalApp <strong>no asesora</strong> sobre qué impuesto corresponde a cada producto ni
          sobre tu régimen. Esa decisión es tuya y de tu contador.</li>
        </ul>`,
    },
    {
      id: 'uso',
      titulo: '8. Uso aceptable',
      html: `
        <p>No puedes usar la plataforma para fines ilícitos; intentar acceder a datos de otros
        clientes; hacer ingeniería inversa, copiar o revender el software; sobrecargar
        deliberadamente la infraestructura; ni usar el asistente para enviar comunicaciones no
        solicitadas o que infrinjan las políticas de WhatsApp o Meta.</p>
        <p>El incumplimiento nos faculta para suspender el servicio de inmediato.</p>`,
    },
    {
      id: 'disponibilidad',
      titulo: '9. Disponibilidad del servicio',
      html: `
        <p>Hacemos <strong>esfuerzos razonables</strong> para mantener el servicio disponible, pero
        <strong>no garantizamos disponibilidad ininterrumpida ni un nivel de servicio (SLA)</strong>
        determinado, salvo que se pacte por escrito y aparte.</p>
        <p>Reconoces y aceptas expresamente que:</p>
        <ul>
          <li>La plataforma se presta sobre infraestructura <strong>sin redundancia ni alta
          disponibilidad</strong>.</li>
          <li>Puede haber interrupciones programadas por mantenimiento —que avisaremos cuando sea
          posible— e interrupciones no programadas por fallas técnicas o de terceros (proveedor de
          infraestructura, WhatsApp/Meta, la DIAN, el proveedor tecnológico de facturación o el
          proveedor del modelo de inteligencia artificial).</li>
          <li>Se realizan <strong>respaldos diarios</strong>. El respaldo reduce el riesgo de
          pérdida, no lo elimina.</li>
        </ul>`,
    },
    {
      id: 'asistente',
      titulo: '10. El asistente conversacional',
      html: `
        <p>Cuando tu plan lo incluya, EscalApp pone a disposición un asistente que atiende
        conversaciones de WhatsApp por tu cuenta. Reconoces que:</p>
        <ul>
          <li>El asistente <strong>puede equivocarse</strong>. Sus respuestas no constituyen una
          oferta vinculante salvo que tú así lo dispongas.</li>
          <li>Puedes <strong>intervenir cualquier conversación</strong> desde la bandeja; al
          hacerlo, el asistente deja de responder en ella hasta que se la devuelvas.</li>
          <li>El servicio depende de <strong>WhatsApp Business Platform (Meta)</strong> y está
          sujeto a sus políticas, incluida la ventana de 24 horas para mensajes de texto libre.</li>
          <li>El número que conectes <strong>dejará de funcionar en la aplicación móvil de
          WhatsApp</strong>, con pérdida del historial de ese dispositivo. Te lo advertimos antes de
          conectarlo.</li>
        </ul>`,
    },
    {
      id: 'responsabilidad',
      titulo: '11. Limitación de responsabilidad',
      html: `
        <p>En la máxima medida permitida por la ley colombiana:</p>
        <ul>
          <li>EscalApp responde por los perjuicios <strong>directos</strong> que le sean imputables,
          hasta un monto máximo equivalente a lo que hayas pagado en los 3 meses anteriores al
          hecho que origina la reclamación.</li>
          <li>EscalApp <strong>no responde</strong> por lucro cesante, pérdida de oportunidades
          comerciales, daño reputacional ni perjuicios indirectos.</li>
          <li>EscalApp <strong>no responde</strong> por sanciones derivadas de la información que tú
          declaraste, por tus incumplimientos tributarios, por fallas de terceros, ni por fuerza
          mayor o caso fortuito.</li>
          <li><strong>Nada de esto limita la responsabilidad por dolo o culpa grave</strong>, ni tus
          derechos irrenunciables.</li>
        </ul>`,
    },
    {
      id: 'datos-terminacion',
      titulo: '12. Tus datos, terminación y qué pasa después',
      html: `
        <p><strong>Tú eres dueño de tu información.</strong> EscalApp la trata para prestarte el
        servicio, según la Política de Tratamiento de Datos y el Anexo de Encargado.</p>
        <p>Cualquiera de las partes puede terminar el contrato avisando con 30 días. La
        terminación no da derecho a devolución de mensualidades ya pagadas, salvo la ley.</p>
        <p>Al terminar, podrás pedir durante 30 días una copia de tu información en un formato de
        uso común. Pasado ese plazo, podremos eliminarla.</p>
        <p><strong>Excepción:</strong> los documentos con efectos fiscales y sus soportes se
        conservan <strong>cinco (5) años</strong> conforme al artículo 632 del Estatuto Tributario,
        aunque el contrato haya terminado y aunque se solicite su supresión. Esa conservación es una
        obligación legal y prevalece sobre la solicitud de eliminación.</p>`,
    },
    {
      id: 'cambios',
      titulo: '13. Cambios en estos términos',
      html: `
        <p>Podemos modificar estos términos. Los cambios <strong>materiales</strong> se avisarán al
        correo registrado con al menos 15 días de antelación. Si no estás de acuerdo, puedes
        terminar el contrato antes de que entren en vigor; seguir usando la plataforma después de
        esa fecha equivale a aceptarlos.</p>`,
    },
    {
      id: 'ley',
      titulo: '14. Ley aplicable y controversias',
      html: `
        <p>Este acuerdo se rige por las leyes de la República de Colombia. Las controversias se
        someterán a los jueces competentes de ${CIUDAD}, previa etapa de arreglo directo de 30
        días.</p>
        <p><strong>${EMPRESA}</strong> (${NOMBRE_COMERCIAL}) · NIT ${NIT} · ${DOMICILIO} · ${CONTACTO}</p>`,
    },
  ],
};

export const PRIVACIDAD: DocumentoLegal = {
  clave: 'privacidad',
  titulo: 'Política de Tratamiento de Datos Personales',
  bajada: 'Conforme a la Ley 1581 de 2012 y al Decreto 1074 de 2015.',
  secciones: [
    {
      id: 'responsable',
      titulo: '1. Responsable del tratamiento',
      html: `<p><strong>${EMPRESA}</strong>, persona natural comerciante que opera bajo el
        establecimiento de comercio <strong>${NOMBRE_COMERCIAL}</strong>.</p>
        <p>NIT ${NIT} · Domicilio ${DOMICILIO} · Correo ${CONTACTO} · Teléfono +57 311 468 2492</p>`,
    },
    {
      id: 'papeles',
      titulo: '2. Dos papeles distintos, y conviene no confundirlos',
      html: `
        <p>EscalApp trata datos personales en dos calidades, y las obligaciones no son las mismas:</p>
        <ul>
          <li><strong>Como Responsable</strong>, de los datos de nuestros clientes: dueños y
          empleados que usan el panel, y de quienes nos contactan.</li>
          <li><strong>Como Encargado</strong>, de los datos de los clientes de nuestros clientes:
          quien reserva una cita, pide por WhatsApp o compra en el negocio. Ahí
          <strong>el Responsable es el negocio</strong>, no nosotros.</li>
        </ul>
        <p>En el segundo caso tratamos esos datos por cuenta y bajo instrucción del negocio, y es él
        quien debe obtener la autorización de sus propios clientes.</p>`,
    },
    {
      id: 'datos',
      titulo: '3. Qué datos tratamos',
      html: `
        <p><strong>De usuarios de la plataforma:</strong> nombres y apellidos, número de
        identificación, correo electrónico, teléfono, cargo o rol, datos del negocio y registros de
        acceso y actividad.</p>
        <p><strong>De los clientes finales de los negocios:</strong> nombre, teléfono, correo
        electrónico, contenido de las conversaciones con el asistente, historial de pedidos, citas o
        compras y —cuando el negocio active la facturación electrónica— tipo y número de documento
        de identidad y dirección.</p>
        <p>No tratamos datos sensibles de forma deliberada. Si un titular los incluye
        espontáneamente en una conversación, se tratan con la misma finalidad de esa conversación y
        no se usan para nada más. La plataforma no está dirigida a menores de edad.</p>`,
    },
    {
      id: 'finalidades',
      titulo: '4. Para qué los tratamos',
      html: `
        <p><strong>Como Responsable:</strong> prestar y operar el servicio; gestionar la cuenta, el
        cobro y la facturación; dar soporte; enviar avisos operativos; cumplir obligaciones legales,
        contables y tributarias; y mejorar la plataforma con información agregada.</p>
        <p><strong>Como Encargado:</strong> únicamente las finalidades que instruya el negocio
        responsable, y ninguna otra. En particular, <strong>no usamos los datos de los clientes
        finales para fines comerciales propios ni los cedemos con fines de mercadeo</strong>.</p>`,
    },
    {
      id: 'derechos',
      titulo: '5. Tus derechos',
      html: `
        <p>Conforme al artículo 8 de la Ley 1581, como titular puedes:</p>
        <ul>
          <li><strong>Conocer</strong> qué datos tuyos tratamos, gratuitamente.</li>
          <li><strong>Actualizar y rectificar</strong> los inexactos, incompletos o
          desactualizados.</li>
          <li>Solicitar <strong>prueba de la autorización</strong> otorgada.</li>
          <li>Ser <strong>informado</strong> del uso que se les ha dado.</li>
          <li>Presentar <strong>quejas ante la Superintendencia de Industria y Comercio</strong>.</li>
          <li><strong>Revocar la autorización y pedir la supresión</strong>, cuando no exista un
          deber legal o contractual de conservarlos.</li>
        </ul>`,
    },
    {
      id: 'ejercer',
      titulo: '6. Cómo ejercerlos, y en cuánto tiempo',
      html: `
        <p>Escríbenos a <strong>${CONTACTO}</strong> indicando tu nombre, documento, la petición
        concreta y un dato de contacto.</p>
        <ul>
          <li><strong>Consultas:</strong> diez (10) días hábiles, prorrogables por cinco (5) más.</li>
          <li><strong>Reclamos:</strong> quince (15) días hábiles, prorrogables por ocho (8) más. Si
          el reclamo llega incompleto, te pediremos completarlo dentro de los cinco (5) días
          siguientes; si no se completa en dos meses, se entiende desistido.</li>
        </ul>
        <p>Si eres cliente de uno de nuestros clientes, trasladaremos tu solicitud al negocio
        responsable —que es quien decide— y te lo informaremos.</p>
        <!-- Enlace RELATIVO a propósito: este HTML entra por innerHTML, así que no puede llevar
             routerLink, y un href absoluto tendría que repetir el baseHref «/admin/». Un href
             relativo se resuelve contra el <base href> del documento — el mismo mecanismo que
             rompió los enlaces del índice— y aquí eso juega a favor: da la URL correcta sin
             cablearla. -->
        <p><strong>¿Solo quieres que borremos tus datos?</strong> Está explicado paso a paso, con
        qué se elimina y qué se conserva por obligación legal, en
        <a href="eliminacion-datos">Cómo eliminar tus datos</a>.</p>`,
    },
    {
      id: 'transferencia',
      titulo: '7. Transferencia internacional de datos',
      html: `
        <p><strong>Tus datos se almacenan y procesan fuera de Colombia, principalmente en Estados
        Unidos.</strong> Esto no es un detalle menor y por eso lo decimos aquí y no en una nota al
        pie:</p>
        <ul>
          <li><strong>Vultr</strong> — infraestructura: el servidor y la base de datos
          (Estados Unidos).</li>
          <li><strong>Meta Platforms</strong> (WhatsApp Business Platform) — envío y recepción de
          mensajes (Estados Unidos).</li>
          <li><strong>Proveedor de modelos de inteligencia artificial</strong> — respuestas del
          asistente (Estados Unidos).</li>
          <li><strong>Proveedor de correo saliente</strong> — notificaciones (Estados Unidos).</li>
          <li><strong>Proveedor tecnológico de facturación electrónica</strong> — emisión de
          documentos ante la DIAN (Colombia).</li>
        </ul>
        <p>Estados Unidos <strong>no figura en el listado de países con nivel adecuado de
        protección</strong> de la Superintendencia de Industria y Comercio (Circular Externa 5 de
        2017). Conforme al artículo 26 de la Ley 1581, una transferencia a un país sin nivel
        adecuado requiere, entre otras vías, la <strong>autorización expresa e inequívoca del
        titular</strong>.</p>
        <p>Por eso, al aceptar esta política <strong>autorizas expresamente</strong> la
        transferencia y transmisión internacional de tus datos a los proveedores señalados, con las
        finalidades indicadas arriba.</p>
        <p><strong>Regla que aplicamos:</strong> los datos de identificación fiscal de los
        compradores —documento de identidad y dirección— <strong>no se envían al proveedor de
        inteligencia artificial</strong>. El asistente no los necesita para funcionar.</p>`,
    },
    {
      id: 'conservacion',
      titulo: '8. Cuánto tiempo los conservamos',
      html: `
        <p>Mientras exista la relación contractual y después durante los plazos legales de
        prescripción.</p>
        <p><strong>Excepción que conviene conocer:</strong> los documentos con efectos fiscales y sus
        soportes se conservan <strong>cinco (5) años</strong> por mandato del artículo 632 del
        Estatuto Tributario. Si solicitas la supresión de datos contenidos en una factura ya
        emitida, prevalece la obligación legal de conservación; lo que sí hacemos es dejar de usar
        esos datos para cualquier otra finalidad, como comunicaciones o mercadeo.</p>`,
    },
    {
      id: 'seguridad',
      titulo: '9. Seguridad',
      html: `
        <p>Aplicamos medidas técnicas y administrativas razonables y proporcionadas al tamaño de la
        operación: cifrado en tránsito (TLS), contraseñas almacenadas con funciones de derivación,
        credenciales de terceros cifradas, control de acceso por roles, aislamiento entre negocios,
        registro de auditoría y respaldos diarios.</p>
        <p>Ninguna medida elimina el riesgo por completo y no prometemos seguridad absoluta. Ante un
        incidente que comprometa datos personales, lo informaremos a los afectados y a la
        Superintendencia de Industria y Comercio conforme a la ley.</p>`,
    },
    {
      id: 'rnbd',
      titulo: '10. Registro Nacional de Bases de Datos',
      html: `
        <p>A la fecha de esta versión, EscalApp no está obligada a inscribirse en el RNBD: esa
        obligación recae sobre sociedades con activos totales superiores a 100.000 UVT y EscalApp
        está por debajo de ese umbral. Se revisará si la situación cambia.</p>`,
    },
    {
      id: 'vigencia',
      titulo: '11. Vigencia y cambios',
      html: `
        <p>Los cambios materiales se publicarán en escalapp.cloud y se avisarán a los usuarios
        registrados. Las bases de datos se conservarán mientras se mantengan las finalidades
        descritas.</p>`,
    },
  ],
};

/**
 * Eliminación de datos — el documento que pide Meta, y que además hacía falta.
 *
 * Meta exige una **URL de instrucciones de eliminación de datos** para publicar una app, y es un
 * campo distinto del de la política de privacidad: el revisor la abre y busca instrucciones
 * concretas, no una cláusula enterrada dentro de otro documento.
 *
 * Pero el documento no se escribió para pasar una revisión. La política ya reconocía el derecho de
 * supresión (§5) y decía por dónde ejercerlo (§6); lo que faltaba era la respuesta a la pregunta
 * que de verdad se hace quien llega aquí: **a quién se lo tengo que pedir.** En EscalApp esa
 * respuesta depende de quién pregunta, porque de un lado somos Responsables y del otro Encargados.
 * Decirlo claro es lo honesto y es además lo que exige la Ley 1581.
 */
export const ELIMINACION: DocumentoLegal = {
  clave: 'eliminacion',
  titulo: 'Cómo eliminar tus datos',
  bajada: 'Qué se borra, a quién se lo pides y en cuánto tiempo respondemos.',
  secciones: [
    {
      id: 'a-quien',
      titulo: '1. Primero: a quién se lo tienes que pedir',
      html: `
        <p>EscalApp trata datos personales en <strong>dos papeles distintos</strong>, y de eso
        depende quién puede borrarlos. Búscate en la tabla:</p>
        <div class="lg__tabla"><table>
          <thead>
            <tr><th>Si tú eres…</th><th>Quién decide sobre tus datos</th><th>A quién escribes</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Un <strong>negocio</strong> que contrató EscalApp, o alguien de su equipo con
              cuenta en la plataforma</td>
              <td><strong>EscalApp</strong> — somos Responsables</td>
              <td>A nosotros, como dice el punto 3</td>
            </tr>
            <tr>
              <td>Un <strong>cliente de un negocio</strong>: escribiste al asistente de WhatsApp,
              hiciste un pedido, reservaste una cita o te atendieron en el mostrador</td>
              <td><strong>El negocio que te atendió</strong> — nosotros solo somos Encargados:
              guardamos sus datos por instrucción suya</td>
              <td>Al negocio. Si nos escribes a nosotros, trasladamos tu solicitud y te avisamos</td>
            </tr>
          </tbody>
        </table></div>
        <p>No es un tecnicismo para pasarte la pelota: es el reparto de papeles que exige la
        <strong>Ley 1581 de 2012</strong>. El negocio decidió qué datos recoger y para qué, así que
        no podemos borrar por nuestra cuenta la información de sus clientes sin su instrucción.</p>
        <p><strong>Aun así, escríbenos si no sabes a quién acudir.</strong> Trasladamos la solicitud
        al negocio responsable, le damos tu contacto y te confirmamos que lo hicimos.</p>`,
    },
    {
      id: 'stop',
      titulo: '2. Si solo quieres dejar de recibir mensajes',
      html: `
        <p>Eso es inmediato y no hace falta escribirle a nadie. <strong>Responde
        <code>STOP</code></strong> a cualquier mensaje del asistente de WhatsApp. También valen
        <code>BAJA</code>, <code>NO MÁS MENSAJES</code>, <code>CANCELAR SUSCRIPCIÓN</code> y
        <code>UNSUBSCRIBE</code>.</p>
        <p>El asistente <strong>se calla en el acto y no vuelve a escribirte</strong>, ni siquiera
        para confirmarte la baja. El silencio es la confirmación: es exactamente lo que pediste.</p>
        <p><strong>Dos cosas que conviene saber, y las decimos antes y no después:</strong></p>
        <ul>
          <li><strong>Darse de baja no es borrar.</strong> Dejas de recibir mensajes, pero la
          conversación anterior sigue guardada. Si además quieres que se elimine, hay que pedirlo
          como dice el punto 3.</li>
          <li><strong>La baja no se deshace escribiendo otra vez.</strong> Está hecha así a
          propósito, porque es una obligación legal y falla del lado seguro. Si te diste de baja por
          error, tiene que reactivarte una persona del negocio.</li>
        </ul>`,
    },
    {
      id: 'como',
      titulo: '3. Cómo pedir la eliminación',
      html: `
        <p>Escribe a <strong>${CONTACTO}</strong> con el asunto
        <strong>«Eliminación de datos»</strong> e incluye:</p>
        <ul>
          <li>Tu <strong>nombre completo</strong> y tu número de documento.</li>
          <li>El <strong>dato con el que te identificamos</strong>: el número de WhatsApp desde el
          que escribiste, o el correo con el que inicias sesión.</li>
          <li>El <strong>nombre del negocio</strong> con el que tuviste contacto, si lo recuerdas.
          Nos ahorra buscarte en el sitio equivocado.</li>
          <li>Qué quieres exactamente: <strong>eliminar todo</strong>, o solo un dato concreto.</li>
        </ul>
        <p>Te pedimos el documento para no borrarle los datos a otra persona: una solicitud de
        supresión que se atiende sin verificar quién la hace es, en la práctica, una forma de
        borrarle la información a cualquiera.</p>
        <p><strong>No hace falta tener cuenta, ni pagar nada.</strong> El acceso y la supresión son
        gratuitos por ley.</p>`,
    },
    {
      id: 'plazos',
      titulo: '4. En cuánto tiempo respondemos',
      html: `
        <p>Son los plazos de los artículos 14 y 15 de la Ley 1581, contados desde que recibimos la
        solicitud completa:</p>
        <div class="lg__tabla"><table>
          <thead><tr><th>Tipo</th><th>Plazo</th><th>Prórroga</th></tr></thead>
          <tbody>
            <tr><td><strong>Consultas</strong> — qué datos míos tienes</td><td>10 días hábiles</td><td>+5 días hábiles</td></tr>
            <tr><td><strong>Reclamos</strong> — corregir, actualizar o suprimir</td><td>15 días hábiles</td><td>+8 días hábiles</td></tr>
          </tbody>
        </table></div>
        <p>Si la solicitud llega incompleta te lo diremos dentro de los cinco (5) días siguientes.
        Si no se completa en dos meses, se entiende desistida y hay que empezar de nuevo.</p>
        <p>Cuando el responsable es el negocio y no nosotros (punto 1), el plazo lo cuenta él; lo
        nuestro es trasladar la solicitud sin demora y confirmártelo.</p>`,
    },
    {
      id: 'que-se-borra',
      titulo: '5. Qué se elimina y qué no',
      html: `
        <p><strong>Se elimina:</strong> tus datos de contacto, tu perfil y tus preferencias, el
        historial de conversaciones con el asistente, y los datos de tu actividad que no estén
        sujetos a un deber legal de conservación.</p>
        <p><strong>No se puede eliminar, y no es una excusa nuestra:</strong></p>
        <ul>
          <li><strong>Facturas y documentos con efectos fiscales</strong>, con sus soportes. El
          artículo 632 del Estatuto Tributario obliga a conservarlos <strong>cinco (5) años</strong>.
          Si tus datos están en una factura ya emitida, esa factura se queda — pero
          <strong>dejamos de usar esos datos para cualquier otra cosa</strong>: nada de
          comunicaciones, mercadeo ni conversaciones futuras.</li>
          <li><strong>Registros de auditoría</strong> mínimos, que son justamente la prueba de que
          atendimos tu solicitud.</li>
          <li>Lo que debamos conservar por una <strong>orden judicial o administrativa</strong>.</li>
        </ul>
        <p>Los <strong>respaldos</strong> se sobrescriben en su ciclo normal: un dato borrado puede
        seguir existiendo unos días en una copia de seguridad, sin usarse para nada, hasta que esa
        copia se reemplaza.</p>`,
    },
    {
      id: 'meta',
      titulo: '6. Si llegaste desde WhatsApp o Facebook',
      html: `
        <p>EscalApp usa la <strong>Plataforma de WhatsApp Business</strong> de Meta para enviar y
        recibir los mensajes del asistente, así que los mensajes pasan también por los sistemas de
        Meta, donde <strong>Meta responde de su propio tratamiento</strong>.</p>
        <p>Esta página cubre los datos que tratamos <strong>nosotros</strong>. Para eliminar lo que
        tenga Meta —tu cuenta de WhatsApp, tu cuenta de Facebook o los datos asociados a ellas— hay
        que pedírselo a Meta desde la configuración de tu cuenta: nosotros no tenemos acceso a eso
        ni podemos borrarlo por ti.</p>`,
    },
    {
      id: 'quejas',
      titulo: '7. Si no te respondemos',
      html: `
        <p>Puedes presentar una queja ante la <strong>Superintendencia de Industria y Comercio
        (SIC)</strong>, que es la autoridad de protección de datos en Colombia. La ley pide haber
        agotado antes la consulta o el reclamo ante nosotros, que es de lo que trata esta página.</p>
        <p>Los demás derechos que tienes como titular —conocer, actualizar, rectificar, pedir prueba
        de la autorización y revocarla— están en la <strong>Política de Tratamiento de Datos
        Personales</strong>, §5.</p>
        <p><strong>${EMPRESA}</strong> (${NOMBRE_COMERCIAL}) · NIT ${NIT} · ${DOMICILIO} ·
        ${CONTACTO}</p>`,
    },
  ],
};

/**
 * Ruta pública y nombre corto de cada documento, para los enlaces cruzados.
 *
 * Vive aquí, al lado del contenido, y no en el componente: añadir un documento tiene que ser tocar
 * UN archivo. El día que el registro y la lista de enlaces vivan en sitios distintos, uno de los
 * dos se queda atrás y aparece un documento publicado al que no enlaza nadie.
 *
 * El orden es el de la navegación, y no es casual: eliminación va al final porque se llega a ella
 * desde la política, no al revés.
 */
export const RUTAS_LEGALES: ReadonlyArray<{
  clave: DocumentoLegal['clave'];
  ruta: string;
  titulo: string;
}> = [
  { clave: 'terminos', ruta: '/terminos', titulo: 'Términos y Condiciones' },
  { clave: 'privacidad', ruta: '/privacidad', titulo: 'Política de Privacidad' },
  { clave: 'eliminacion', ruta: '/eliminacion-datos', titulo: 'Eliminar mis datos' },
];

export const DOCUMENTOS: Record<string, DocumentoLegal> = {
  terminos: TERMINOS,
  privacidad: PRIVACIDAD,
  eliminacion: ELIMINACION,
};

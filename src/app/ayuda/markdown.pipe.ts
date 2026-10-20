import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { markdownAHtml } from './markdown';

/**
 * `{{ tema.cuerpo | markdown }}` para las guías escritas.
 *
 * `bypassSecurityTrustHtml` es seguro aquí **porque `markdownAHtml` escapa el texto entero antes
 * de poner una sola etiqueta**: el HTML que sale lo compuso ese archivo, no la base de datos. Si
 * alguien cambia ese orden, este pipe se vuelve un agujero — está dicho en su cabecera.
 *
 * Pure (el valor por defecto): el markdown de un tema no cambia mientras se ve.
 */
@Pipe({ name: 'markdown', standalone: true })
export class MarkdownPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(valor: string | null | undefined): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(markdownAHtml(valor));
  }
}

/**
 * Para el extracto que arma `ts_headline` en Postgres, que trae `<mark>` alrededor de lo que
 * coincidió y nada más.
 *
 * Va por separado porque ese texto NO es markdown: viene de la base ya con una etiqueta dentro,
 * así que se escapa todo y luego se devuelven solo los `<mark>`. Pasarlo por el pipe de markdown
 * habría dejado `&lt;mark&gt;` a la vista; pasarlo sin escapar sería confiar en que el cuerpo de
 * un capítulo nunca contenga HTML.
 */
@Pipe({ name: 'resaltado', standalone: true })
export class ResaltadoPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(valor: string | null | undefined): SafeHtml {
    if (!valor) return '';
    const seguro = valor
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/&lt;mark&gt;/g, '<mark>')
      .replace(/&lt;\/mark&gt;/g, '</mark>');
    return this.sanitizer.bypassSecurityTrustHtml(seguro);
  }
}

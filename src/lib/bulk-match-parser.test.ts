// ============================================================================
// SECCIÓN 1: IMPORTACIONES DEL PARSER DE CARGA MASIVA
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildBulkExampleText, parseBulkMatchesText } from './bulk-match-parser.ts';





// ============================================================================
// SECCIÓN 2: PRUEBAS UNITARIAS DE PARSEO, VALIDACIÓN Y TOPE DE 10 PARTIDOS
// ============================================================================

describe('parseBulkMatchesText', () => {
  it('parsea correctamente 10 líneas completas con cuotas 1X2 y asigna order_index del 1 al 10', () => {
    const sample = buildBulkExampleText(new Date('2026-11-26T12:00:00Z'));
    const result = parseBulkMatchesText(sample);

    assert.equal(result.errors.length, 0);
    assert.equal(result.matches.length, 10);
    assert.equal(result.matches[0].order_index, 1);
    assert.equal(result.matches[0].competition_name, 'Liga Profesional');
    assert.equal(result.matches[0].home_team, 'River Plate');
    assert.equal(result.matches[0].away_team, 'Boca Juniors');
    assert.equal(result.matches[0].odd_home, 2.4);
    assert.equal(result.matches[0].odd_draw, 3.1);
    assert.equal(result.matches[0].odd_away, 2.95);
    assert.equal(result.matches[9].order_index, 10);
  });

  it('admite líneas sin cuotas opcionales y comas decimales en cuotas', () => {
    const input = [
      'Primera Nacional | Ferro vs Chacarita | 2026-11-29 19:00',
      'Serie A | Roma vs. Lazio | 2026-11-29 20:45 | 2,45 - 3,10 - 2,85',
    ].join('\n');

    const result = parseBulkMatchesText(input, { startOrderIndex: 3, maxMatches: 8 });

    assert.equal(result.errors.length, 0);
    assert.equal(result.matches.length, 2);
    assert.equal(result.matches[0].order_index, 3);
    assert.equal(result.matches[0].odd_home, null);
    assert.equal(result.matches[1].order_index, 4);
    assert.equal(result.matches[1].odd_home, 2.45);
  });

  it('reporta errores claros por línea inválida y respeta el límite máximo', () => {
    const input = [
      'SinSeparadores',
      'Liga | SoloUnEquipo | 2026-11-29 18:00',
      'Liga | A vs B | fecha-invalida',
      'Liga | A vs B | 2026-11-29 18:00 | 0.90 - 3.00 - 2.50',
      'Liga | A vs B | 2026-11-29 18:00 | 2.30 - 3.10 - 2.95',
      'Liga | C vs D | 2026-11-29 20:00 | 2.40 - 3.00 - 2.80',
    ].join('\n');

    const result = parseBulkMatchesText(input, { maxMatches: 1 });

    assert.equal(result.matches.length, 1);
    assert.equal(result.errors.length, 5);
    assert.equal(result.errors[4].lineNumber, 6);
  });
});


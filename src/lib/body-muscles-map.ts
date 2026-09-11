// Traduccion entre nuestros nombres de grupo muscular (los 22 body_parts +
// los DEFAULT_MUSCLE_GROUPS de muscle-groups.ts, ambos en espanol) y los
// ids ingles de la libreria `body-muscles` (npm, Apache 2.0) — 70+ regiones
// con lado izquierdo/derecho separado. Como nuestros datos no distinguen
// lateralidad, cada grupo se mapea a AMBOS lados (se colorean igual) —
// asuncion de entrenamiento bilateral, razonable para la inmensa mayoria
// de ejercicios del catalogo.
//
// Tabla de autoria propia (no viene de ninguna fuente externa) — mantenida
// en espejo con constants/bodyMusclesMap.ts de la app movil; si cambia una,
// cambiar la otra.
export const CANONICAL_TO_BODY_MUSCLES: Record<string, string[]> = {
  // --- de body_parts (22 genericos) ---
  'Pecho': ['chest-upper-left', 'chest-upper-right', 'chest-lower-left', 'chest-lower-right'],
  'Espalda': [
    'lats-upper-left', 'lats-mid-left', 'lats-lower-left',
    'lats-upper-right', 'lats-mid-right', 'lats-lower-right',
    'traps-upper-left', 'traps-mid-left', 'traps-lower-left',
    'traps-upper-right', 'traps-mid-right', 'traps-lower-right',
  ],
  'Hombros': [
    'shoulder-front-left', 'shoulder-front-right',
    'shoulder-side-left', 'shoulder-side-right',
    'deltoid-rear-left', 'deltoid-rear-right',
  ],
  'Deltoides anterior': ['shoulder-front-left', 'shoulder-front-right'],
  'Deltoides lateral': ['shoulder-side-left', 'shoulder-side-right'],
  'Deltoides posterior': ['deltoid-rear-left', 'deltoid-rear-right'],
  'Bíceps': ['biceps-left', 'biceps-right'],
  'Tríceps': ['triceps-long-left', 'triceps-lateral-left', 'triceps-long-right', 'triceps-lateral-right'],
  'Antebrazos': [
    'forearm-left', 'forearm-right',
    'forearm-flexors-left', 'forearm-extensors-left',
    'forearm-flexors-right', 'forearm-extensors-right',
  ],
  'Trapecios': ['traps-upper-left', 'traps-mid-left', 'traps-lower-left', 'traps-upper-right', 'traps-mid-right', 'traps-lower-right'],
  'Cuello': ['neck-left', 'neck-right', 'nape', 'head-back'],
  'Core': [
    'abs-upper-left', 'abs-upper-right', 'abs-lower-left', 'abs-lower-right',
    'obliques-left', 'obliques-right',
  ],
  'Abdominales': ['abs-upper-left', 'abs-upper-right', 'abs-lower-left', 'abs-lower-right'],
  'Oblicuos': ['obliques-left', 'obliques-right'],
  'Glúteos': ['gluteus-medius-left', 'gluteus-maximus-left', 'gluteus-medius-right', 'gluteus-maximus-right'],
  'Cuádriceps': ['quads-left', 'quads-right'],
  'Isquiotibiales': ['hamstrings-medial-left', 'hamstrings-lateral-left', 'hamstrings-medial-right', 'hamstrings-lateral-right'],
  'Aductores': ['adductors-left', 'adductors-right'],
  // La libreria no tiene region dedicada a abductores; el gluteo medio es su principal abductor.
  'Abductores': ['gluteus-medius-left', 'gluteus-medius-right'],
  'Gemelos': [
    'calves-gastroc-medial-left', 'calves-gastroc-lateral-left', 'calves-soleus-left',
    'calves-gastroc-medial-right', 'calves-gastroc-lateral-right', 'calves-soleus-right',
  ],
  'Tibial anterior': ['tibialis-anterior-left', 'tibialis-anterior-right'],
  // 'Cuerpo completo' deliberadamente sin mapeo — no corresponde a una region concreta a resaltar.

  // --- de DEFAULT_MUSCLE_GROUPS (canonicos, mas finos) ---
  'Antebrazo': [
    'forearm-left', 'forearm-right',
    'forearm-flexors-left', 'forearm-extensors-left',
    'forearm-flexors-right', 'forearm-extensors-right',
  ],
  'Espalda alta': ['traps-upper-left', 'traps-upper-right', 'lats-upper-left', 'lats-upper-right'],
  'Dorsales': ['lats-upper-left', 'lats-mid-left', 'lats-lower-left', 'lats-upper-right', 'lats-mid-right', 'lats-lower-right'],
  'Lumbar': ['lower-back-erectors-left', 'lower-back-ql-left', 'lower-back-erectors-right', 'lower-back-ql-right', 'spine'],
  'Gluteo': ['gluteus-medius-left', 'gluteus-maximus-left', 'gluteus-medius-right', 'gluteus-maximus-right'],
  'Gluteo mayor': ['gluteus-maximus-left', 'gluteus-maximus-right'],
  // La libreria no distingue medio/menor de gluteo — ambos usan el mismo id "medius".
  'Gluteo medio': ['gluteus-medius-left', 'gluteus-medius-right'],
  'Gluteo menor': ['gluteus-medius-left', 'gluteus-medius-right'],
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

const NORMALIZED_MAP = new Map<string, string[]>(
  Object.entries(CANONICAL_TO_BODY_MUSCLES).map(([k, v]) => [normalize(k), v])
)

/** Ids de body-muscles a resaltar para un nombre de grupo canonico dado. */
export function bodyMusclesIdsFor(canonicalGroup: string): string[] {
  return NORMALIZED_MAP.get(normalize(canonicalGroup)) ?? []
}

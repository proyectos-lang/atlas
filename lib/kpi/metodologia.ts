/**
 * Metodología de cálculo, para la sección "Acerca de".
 *
 * Es documentación, no motor: nada de lo que hay aquí participa del
 * cálculo. La fuente de verdad sigue siendo
 * `supabase/migraciones/05_vistas_kpi.sql`, y lo que se escribe en
 * `formula` es su transcripción legible.
 *
 * SI SE CAMBIA UNA FÓRMULA EN EL SQL, HAY QUE CAMBIARLA AQUÍ. Una
 * documentación que miente es peor que no tenerla: `pruebas/metodologia.test.ts`
 * comprueba al menos que cada indicador del catálogo esté explicado y que los
 * parámetros citados existan.
 */

export interface ExplicacionIndicador {
  /** Código del catálogo (lib/kpi/catalogo.ts). */
  codigo: string
  /** Qué mide, en una frase, sin jerga. Nivel 1: lo lee un docente. */
  queMide: string
  /** Fórmula legible. Nivel 2: la lee quien audita el cálculo. */
  formula: string
  /** Tablas y columnas de origen. */
  origen: string
  /** Parámetro configurable que interviene, si lo hay. */
  parametro?: { codigo: string; valor: string; descripcion: string }
  /** Cómo leer el resultado, o qué cuidado tener al interpretarlo. */
  interpretacion?: string
  /** Se limita a 100 por estudiante antes de promediar. */
  trunca: boolean
  /** El valor esperado se reduce al filtrar por semanas. */
  prorratea: boolean
  /** Advertencia que el lector debe conocer antes de usar el número. */
  advertencia?: string
}

export interface BloqueCompetencia {
  competencia: string
  indice: string
  descripcion: string
  subIndicadores: readonly string[]
}

/** Las cuatro reglas que gobiernan todo el motor. */
export const REGLAS: readonly {
  numero: number
  titulo: string
  explicacion: string
  porQue: string
}[] = [
  {
    numero: 1,
    titulo: 'Se calcula por estudiante y después se promedia',
    explicacion:
      'Cada indicador de razón se calcula primero para cada estudiante. ' +
      'El valor del grupo es el promedio de esos valores individuales, ' +
      'nunca la suma del grupo dividida entre lo esperado del grupo.',
    porQue:
      'Las dos formas dan resultados distintos. Dividir totales entre totales ' +
      'deja que unos pocos estudiantes muy activos compensen a muchos inactivos, ' +
      'y el número resultante no representa a ninguna persona real.',
  },
  {
    numero: 2,
    titulo: 'El truncamiento en 100 se aplica antes de promediar',
    explicacion:
      'Quien supera lo esperado aporta 100, no 140. El límite se aplica al valor ' +
      'de cada estudiante, antes de calcular el promedio del grupo.',
    porQue:
      'El orden cambia el resultado. La Reciprocidad de Interacción entre Pares ' +
      'llega al tope en 35 de los 36 estudiantes: promediar primero y truncar ' +
      'después ocultaría esa saturación y daría un número distinto.',
  },
  {
    numero: 3,
    titulo: 'Los valores esperados se prorratean por semanas',
    explicacion:
      'Al filtrar por semanas, el valor esperado se reduce en la misma proporción: ' +
      'factor = semanas del ámbito ÷ semanas del curso. Si se esperan 18 intervenciones ' +
      'en 6 semanas y se mira 1 sola semana, lo esperado pasa a ser 3.',
    porQue:
      'Sin prorrateo, filtrar una semana comparaba la actividad de esa semana contra ' +
      'lo esperado del curso entero. El Índice de Trabajo en Equipo caía de 66 % a 25 % ' +
      'sin que nada hubiera cambiado en los datos.',
  },
  {
    numero: 4,
    titulo: 'Todo en escala 0–100, salvo la brecha',
    explicacion:
      'Todos los indicadores se expresan de 0 a 100 y se leen con la escala de dominio. ' +
      'La excepción es el Índice de Brecha de Aprendizaje, que va en puntos y puede ser ' +
      'negativo cuando el logro supera lo esperado.',
    porQue:
      'Un indicador en puntos no se puede colorear con la escala de dominio: un valor ' +
      'negativo es una buena noticia, y el color lo mostraría como deficiente.',
  },
]

/** La excepción a la regla 3, lo bastante importante para nombrarla aparte. */
export const EXCEPCION_CPP =
  'El Cumplimiento de Plazos Programados no se prorratea. Se divide siempre entre ' +
  'las 5 actividades programadas del curso, se mire una semana o las seis. Hay dos ' +
  'motivos: las entregas no tienen semana registrada en el origen, y las 5 actividades ' +
  'son del curso completo, no de una semana concreta.'

export const COMPETENCIAS_EXPLICADAS: readonly BloqueCompetencia[] = [
  {
    competencia: 'Trabajo en Equipo',
    indice: 'ITE',
    descripcion:
      'Mide si el estudiante participa con otros y aporta al grupo: cuánto interactúa ' +
      'frente a cuánto publica por su cuenta, y si su aporte es proporcional al del curso.',
    subIndicadores: ['ICOL', 'TPI', 'RIP', 'NCG', 'TA'],
  },
  {
    competencia: 'Aprendizaje Autónomo',
    indice: 'IAU',
    descripcion:
      'Mide la constancia del estudiante por su cuenta: con qué frecuencia entra, cuánto ' +
      'tiempo dedica, qué recursos consulta y si entrega a tiempo.',
    subIndicadores: ['FA', 'TE', 'UPR', 'CPP', 'TPS'],
  },
  {
    competencia: 'Comunicación Efectiva',
    indice: 'ICOM',
    descripcion:
      'Mide la calidad de lo que el estudiante escribe y cómo responde a otros, no ' +
      'sólo cuánto participa.',
    subIndicadores: ['CLT', 'NPA', 'CID', 'CRF'],
  },
  {
    competencia: 'Pensamiento Crítico',
    indice: 'IPC',
    descripcion:
      'Se evalúa íntegramente con rúbrica docente: argumentación, síntesis, evaluación ' +
      'de alternativas y toma de decisiones fundamentadas.',
    subIndicadores: ['NA', 'NS', 'EA', 'TD'],
  },
  {
    competencia: 'Resolución de Problemas',
    indice: 'IRP',
    descripcion:
      'Combina rúbrica docente (identificar problemas, aplicar estrategias) con el ' +
      'desempeño real en las evaluaciones del curso.',
    subIndicadores: ['NIA', 'TRA', 'UEA', 'DPA'],
  },
]

const P = (codigo: string, valor: string, descripcion: string) => ({
  codigo,
  valor,
  descripcion,
})

export const EXPLICACIONES: readonly ExplicacionIndicador[] = [
  // ---------- Trabajo en Equipo ----------
  {
    codigo: 'ICOL',
    queMide:
      'Qué proporción de la actividad del estudiante es interacción con otros, frente ' +
      'a publicar en foro sin responder a nadie.',
    formula: '100 × interacciones ÷ (interacciones + intervenciones en foro)',
    origen: 'colaboracion.interacciones y foros.intervenciones',
    interpretacion:
      'Es una proporción, no una cantidad: un estudiante poco activo pero que siempre ' +
      'responde a otros puede salir alto. Léalo junto a la Tasa de Participación.',
    trunca: false,
    prorratea: false,
    advertencia:
      'Un estudiante sin actividad alguna en el período cuenta 0, no vacío. En el conjunto ' +
      'completo no ocurre, pero al filtrar una sola semana sí, y un vacío contaminaría ' +
      'el promedio de toda la competencia.',
  },
  {
    codigo: 'TPI',
    queMide: 'Cuánto participa en foros respecto de lo que se espera del curso.',
    formula: '100 × intervenciones ÷ (18 × factor de semanas)',
    origen: 'foros.intervenciones',
    parametro: P('TPI', '18 intervenciones', 'Intervenciones esperadas en foros'),
    trunca: true,
    prorratea: true,
  },
  {
    codigo: 'RIP',
    queMide:
      'Si el estudiante entra en conversación de ida y vuelta: respuestas que da más ' +
      'respuestas que recibe.',
    formula:
      '100 × (respuestas emitidas + respuestas recibidas) ÷ (12 × factor de semanas)',
    origen: 'foros.respuestas_emitidas y foros.respuestas_recibidas',
    parametro: P('RIP', '12 estudiantes', 'Estudiantes del curso'),
    trunca: true,
    prorratea: true,
    advertencia:
      'Llega al tope de 100 en 35 de los 36 estudiantes del conjunto. Está saturado: ' +
      'no sirve para distinguir entre estudiantes, sólo para detectar a quien no participa.',
  },
  {
    codigo: 'NCG',
    queMide: 'Qué parte del total de aportes del curso viene de este estudiante.',
    formula: '100 × aportes del estudiante ÷ aportes totales del curso',
    origen: 'colaboracion.aportes',
    interpretacion:
      'El denominador es el curso, no un valor esperado fijo. Por eso no necesita ' +
      'prorrateo: numerador y denominador se filtran por las mismas semanas.',
    trunca: true,
    prorratea: false,
  },
  {
    codigo: 'TA',
    queMide: 'Cuántos aportes colaborativos hace, respecto de lo esperado.',
    formula: '100 × aportes ÷ (22 × factor de semanas)',
    origen: 'colaboracion.aportes',
    parametro: P('TA', '22 aportes', 'Aportes colaborativos esperados'),
    trunca: true,
    prorratea: true,
  },

  // ---------- Aprendizaje Autónomo ----------
  {
    codigo: 'FA',
    queMide: 'Con qué frecuencia entra a la plataforma, respecto de lo esperado.',
    formula: '100 × accesos ÷ (60 × factor de semanas)',
    origen: 'moodle_logs.accesos',
    parametro: P('FA', '60 accesos', 'Accesos esperados en el curso'),
    trunca: true,
    prorratea: true,
  },
  {
    codigo: 'TE',
    queMide: 'Cuánto tiempo dedica, respecto de lo esperado.',
    formula: '100 × minutos ÷ (1500 × factor de semanas)',
    origen: 'moodle_logs.minutos',
    parametro: P('TE', '1500 minutos', 'Minutos de estudio esperados'),
    trunca: true,
    prorratea: true,
    interpretacion:
      'Mide tiempo conectado, que no es lo mismo que tiempo aprovechado. Un valor alto ' +
      'no acredita aprendizaje por sí solo.',
  },
  {
    codigo: 'UPR',
    queMide: 'Cuántos recursos del curso consulta, respecto de lo esperado.',
    formula: '100 × recursos consultados ÷ (48 × factor de semanas)',
    origen: 'moodle_logs.recursos_consultados',
    parametro: P('UPR', '48 consultas', 'Consultas de recursos esperadas'),
    trunca: true,
    prorratea: true,
  },
  {
    codigo: 'CPP',
    queMide: 'Qué proporción de las actividades programadas entrega a tiempo.',
    formula: '100 × entregas puntuales ÷ 5 actividades programadas',
    origen: 'evaluaciones.entrega_puntual',
    parametro: P('CPP', '5 actividades', 'Actividades programadas'),
    trunca: true,
    prorratea: false,
    advertencia:
      'Única excepción a la regla de prorrateo: el denominador es siempre 5, se mire ' +
      'una semana o las seis. Las entregas no tienen semana registrada en el origen.',
  },
  {
    codigo: 'TPS',
    queMide: 'En cuántas semanas del período tuvo actividad, de las semanas posibles.',
    formula: '100 × semanas con al menos un acceso ÷ semanas del ámbito',
    origen: 'moodle_logs.accesos, contando semanas distintas',
    trunca: true,
    prorratea: true,
    interpretacion:
      'Mide constancia, no intensidad. Entrar los seis días una vez al día puntúa más ' +
      'que concentrar todo el trabajo en un solo día.',
  },

  // ---------- Comunicación Efectiva ----------
  {
    codigo: 'CLT',
    queMide: 'La calidad argumentativa media de lo que escribe en foros.',
    formula: 'Promedio de la calidad argumentativa de sus intervenciones',
    origen: 'foros.calidad_argumentativa, que ya viene en escala 0–100',
    trunca: false,
    prorratea: false,
    interpretacion:
      'Es un promedio de calidad, no una razón: no se compara contra un valor esperado ' +
      'ni se ve afectado por el número de intervenciones.',
  },
  {
    codigo: 'NPA',
    queMide:
      'Qué proporción de sus intervenciones alcanza el umbral de calidad argumentativa.',
    formula: '100 × intervenciones con calidad ≥ 70 ÷ total de intervenciones',
    origen: 'foros.calidad_argumentativa',
    parametro: P('NPA', '70 puntos', 'Umbral de calidad argumentativa'),
    trunca: false,
    prorratea: false,
    advertencia:
      'El umbral 70 está fijado en el código del motor, no se lee del parámetro: ' +
      'cambiar el parámetro NPA en la configuración no altera este indicador.',
  },
  {
    codigo: 'CID',
    queMide: 'Cuánto responde a otros en debates, respecto de lo esperado.',
    formula: '100 × respuestas emitidas ÷ (15 × factor de semanas)',
    origen: 'foros.respuestas_emitidas',
    parametro: P('CID', '15 respuestas', 'Respuestas esperadas en debates'),
    trunca: true,
    prorratea: true,
  },
  {
    codigo: 'CRF',
    queMide: 'La calidad media de la retroalimentación que da a sus compañeros.',
    formula: 'Promedio de la evaluación entre pares recibida por sus aportes',
    origen: 'colaboracion.evaluacion_pares, ya en escala 0–100',
    trunca: false,
    prorratea: false,
  },

  // ---------- Pensamiento Crítico (rúbrica) ----------
  {
    codigo: 'NA',
    queMide: 'Si fundamenta sus argumentos, según la rúbrica del debate académico.',
    formula: '100 × suma de lo obtenido ÷ suma del máximo posible',
    origen: 'rubrica, criterio «Argumentos fundamentados» (máximo 10 por semana)',
    trunca: false,
    prorratea: false,
  },
  {
    codigo: 'NS',
    queMide: 'Si integra y sintetiza ideas, según la rúbrica del estudio de caso.',
    formula: '100 × suma de lo obtenido ÷ suma del máximo posible',
    origen: 'rubrica, criterio «Integración y síntesis de ideas» (máximo 100 por semana)',
    trunca: false,
    prorratea: false,
  },
  {
    codigo: 'EA',
    queMide: 'Si evalúa alternativas antes de decidir, según rúbrica.',
    formula: '100 × suma de lo obtenido ÷ suma del máximo posible',
    origen: 'rubrica, criterio «Alternativas evaluadas correctamente» (máximo 5 por semana)',
    trunca: false,
    prorratea: false,
  },
  {
    codigo: 'TD',
    queMide: 'Si justifica sus decisiones con evidencia, según rúbrica.',
    formula: '100 × suma de lo obtenido ÷ suma del máximo posible',
    origen: 'rubrica, criterio «Decisiones justificadas con evidencia» (máximo 5 por semana)',
    trunca: false,
    prorratea: false,
  },

  // ---------- Resolución de Problemas ----------
  {
    codigo: 'NIA',
    queMide: 'Si identifica correctamente el problema, según rúbrica del reto aplicado.',
    formula: '100 × suma de lo obtenido ÷ suma del máximo posible',
    origen: 'rubrica, criterio «Problemas identificados correctamente» (máximo 6 por semana)',
    trunca: false,
    prorratea: false,
  },
  {
    codigo: 'TRA',
    queMide: 'Qué proporción de las evaluaciones resuelve satisfactoriamente.',
    formula: '100 × evaluaciones con calificación ≥ 70 ÷ total de evaluaciones',
    origen: 'evaluaciones.calificacion',
    parametro: P('TRA', '70 puntos', 'Umbral de actividad resuelta'),
    trunca: false,
    prorratea: false,
    advertencia:
      'No cambia al filtrar por semana: las evaluaciones no tienen semana registrada ' +
      'en el origen. Además, el umbral 70 está fijado en el código y no se lee del parámetro.',
  },
  {
    codigo: 'UEA',
    queMide: 'Si aplica estrategias de análisis, según rúbrica del reto aplicado.',
    formula: '100 × suma de lo obtenido ÷ suma del máximo posible',
    origen: 'rubrica, criterio «Estrategias de análisis aplicadas» (máximo 4 por semana)',
    trunca: false,
    prorratea: false,
  },
  {
    codigo: 'DPA',
    queMide: 'Su desempeño global en las evaluaciones del curso.',
    formula: '100 × suma de calificaciones ÷ suma de puntajes máximos',
    origen: 'evaluaciones.calificacion y evaluaciones.puntaje_maximo',
    trunca: false,
    prorratea: false,
    advertencia: 'No cambia al filtrar por semana: las evaluaciones no tienen semana en el origen.',
  },

  // ---------- Índices ----------
  {
    codigo: 'ITE',
    queMide: 'La competencia de Trabajo en Equipo del estudiante.',
    formula: '(ICOL + TPI + RIP + NCG + TA) ÷ 5',
    origen: 'Promedio simple de sus cinco sub-indicadores, ya truncados',
    trunca: false,
    prorratea: false,
  },
  {
    codigo: 'IAU',
    queMide: 'La competencia de Aprendizaje Autónomo del estudiante.',
    formula: '(FA + TE + UPR + CPP + TPS) ÷ 5',
    origen: 'Promedio simple de sus cinco sub-indicadores, ya truncados',
    trunca: false,
    prorratea: false,
  },
  {
    codigo: 'ICOM',
    queMide: 'La competencia de Comunicación Efectiva del estudiante.',
    formula: '(CLT + NPA + CID + CRF) ÷ 4',
    origen: 'Promedio simple de sus cuatro sub-indicadores',
    trunca: false,
    prorratea: false,
  },
  {
    codigo: 'IPC',
    queMide: 'La competencia de Pensamiento Crítico del estudiante.',
    formula: '(NA + NS + EA + TD) ÷ 4',
    origen: 'Promedio simple de sus cuatro criterios de rúbrica',
    trunca: false,
    prorratea: false,
  },
  {
    codigo: 'IRP',
    queMide: 'La competencia de Resolución de Problemas del estudiante.',
    formula: '(NIA + TRA + UEA + DPA) ÷ 4',
    origen: 'Promedio simple de sus cuatro sub-indicadores',
    trunca: false,
    prorratea: false,
  },
  {
    codigo: 'CTG',
    queMide: 'La competencia transversal del estudiante, resumida en un solo número.',
    formula:
      '(ITE×peso + IAU×peso + ICOM×peso + IPC×peso + IRP×peso) ÷ suma de los pesos',
    origen: 'Los cinco índices, ponderados por los pesos configurados por curso',
    parametro: P('ITE · IAU · ICOM · IPC · IRP', '0,20 cada uno', 'Peso en el índice global'),
    trunca: false,
    prorratea: false,
    interpretacion:
      'Dividir entre la suma de los pesos mantiene la escala 0–100 aunque el docente ' +
      'cambie los pesos. Con los pesos actuales (todos 0,20) equivale al promedio simple ' +
      'de los cinco índices.',
  },

  // ---------- Resultados de aprendizaje ----------
  {
    codigo: 'ILRA',
    queMide:
      'Qué proporción de los resultados de aprendizaje del programa alcanza el estudiante.',
    formula: '100 × resultados con logro ≥ 70 ÷ total de resultados del estudiante',
    origen: 'resultados_aprendizaje.logro_porcentaje (RA1 a RA5)',
    parametro: P('ILRA', '70 puntos', 'Umbral de logro del resultado de aprendizaje'),
    trunca: false,
    prorratea: false,
  },
  {
    codigo: 'TLC',
    queMide: 'El logro medio del estudiante en los resultados de aprendizaje.',
    formula: 'Promedio del logro de sus resultados de aprendizaje',
    origen: 'resultados_aprendizaje.logro_porcentaje',
    trunca: false,
    prorratea: false,
  },
  {
    codigo: 'IBA',
    queMide: 'Cuántos puntos le faltan al estudiante para el logro esperado.',
    formula: '85 − logro medio del estudiante',
    origen: 'resultados_aprendizaje.logro_porcentaje',
    parametro: P('IBA', '85 puntos', 'Logro esperado del resultado de aprendizaje'),
    trunca: false,
    prorratea: false,
    advertencia:
      'Va en PUNTOS, no en porcentaje, y puede ser negativo. Un valor negativo significa ' +
      'que el estudiante supera lo esperado: es una buena noticia. No se lee con la escala ' +
      'de dominio ni se colorea con ella.',
  },
  {
    codigo: 'NLA',
    queMide: 'El desempeño global del estudiante en las evaluaciones.',
    formula: '100 × suma de calificaciones ÷ suma de puntajes máximos',
    origen: 'evaluaciones.calificacion y evaluaciones.puntaje_maximo',
    trunca: false,
    prorratea: false,
    interpretacion:
      'Numéricamente idéntico al Desempeño en Problemas Aplicados: cambia el encuadre, ' +
      'no el cálculo. Aquí se lee como resultado de aprendizaje; allí, como competencia.',
  },
]

/** Las cinco etapas del embudo de progresión, con su criterio exacto. */
export const ETAPAS_EMBUDO: readonly {
  etapa: number
  nombre: string
  criterio: string
  nota?: string
}[] = [
  {
    etapa: 1,
    nombre: 'Estudiantes matriculados',
    criterio: 'Todos los usuarios con rol Estudiante dentro del ámbito seleccionado.',
  },
  {
    etapa: 2,
    nombre: 'Activos en la plataforma',
    criterio: 'Con al menos un acceso en la mitad o más de las semanas del curso.',
    nota: 'Con 6 semanas, hacen falta 3 semanas con acceso.',
  },
  {
    etapa: 3,
    nombre: 'Participan de forma sostenida',
    criterio:
      'Con al menos una intervención en foro en la mitad o más de las semanas del curso.',
    nota: 'Entrar no basta: hay que participar, y de forma repartida en el tiempo.',
  },
  {
    etapa: 4,
    nombre: 'Logran los resultados de aprendizaje',
    criterio: 'Índice individual de logro de resultados de aprendizaje igual o mayor que 60.',
  },
  {
    etapa: 5,
    nombre: 'Desarrollan las competencias',
    criterio: 'Competencia Transversal Global individual igual o mayor que 75.',
    nota:
      'El umbral 75 es exactamente el límite inferior del nivel Alto de la escala de dominio: ' +
      'esta etapa cuenta a quien alcanza dominio Alto, no a quien simplemente aprueba.',
  },
]

/** Cifras que el motor debe reproducir. Verificables con `npm run motor`. */
export const VALORES_REFERENCIA: readonly { indicador: string; valor: string }[] = [
  { indicador: 'Competencia Transversal Global', valor: '73,4 %' },
  { indicador: 'Índice de Trabajo en Equipo', valor: '66,7 %' },
  { indicador: 'Índice de Aprendizaje Autónomo', valor: '83,6 %' },
  { indicador: 'Índice de Comunicación Efectiva', valor: '74,9 %' },
  { indicador: 'Índice de Pensamiento Crítico', valor: '74,1 %' },
  { indicador: 'Índice de Resolución de Problemas', valor: '68,0 %' },
  { indicador: 'Índice de Logro de Resultados de Aprendizaje', valor: '57,8 %' },
  { indicador: 'Embudo de progresión', valor: '36 · 36 · 36 · 24 · 11' },
]

export function explicacionDe(codigo: string): ExplicacionIndicador | undefined {
  return EXPLICACIONES.find((e) => e.codigo === codigo)
}

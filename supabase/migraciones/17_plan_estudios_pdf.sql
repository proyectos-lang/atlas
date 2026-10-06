-- ============================================================
-- ATLAS · 17 · Plan de estudios en PDF
-- ============================================================

-- El plan general de estudios era sólo un campo de texto. Ahora admite
-- además el documento oficial en PDF.
--
-- AMBOS CONVIVEN, no se sustituyen: el texto lo puede leer el agente de
-- IA como contexto; el PDF es el documento completo para consultar. Un
-- PDF no es legible por el agente, así que reemplazar el texto por el
-- archivo le quitaría contexto que hoy sí usa.
--
-- El archivo vive en el bucket `atlas-documentos`, que es PRIVADO: se
-- sirve con URL firmada temporal, no con enlace permanente. Aquí sólo se
-- guarda la referencia, nunca los bytes: un PDF de varios MB dentro de la
-- tabla inflaría cada copia de seguridad y cada consulta que la lea.
--
-- ES IDEMPOTENTE.

alter table atlas.programas_macro
  -- Ruta dentro del bucket, no una URL: las URLs firmadas caducan, así
  -- que guardarlas dejaría enlaces muertos en la base.
  add column if not exists plan_estudios_archivo text,
  add column if not exists plan_estudios_nombre  text,
  add column if not exists plan_estudios_tamano  bigint,
  add column if not exists plan_estudios_subido_en timestamptz,
  add column if not exists plan_estudios_subido_por bigint
    references atlas.perfiles(id);

comment on column atlas.programas_macro.plan_estudios_archivo is
  'Ruta en el bucket atlas-documentos. NO es una URL: las firmadas caducan.';

-- Si hay archivo, tiene que haber nombre para mostrarlo: una referencia
-- sin nombre sale en pantalla como un enlace sin etiqueta.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ck_plan_estudios_archivo'
  ) then
    alter table atlas.programas_macro
      add constraint ck_plan_estudios_archivo
      check (
        plan_estudios_archivo is null
        or length(btrim(coalesce(plan_estudios_nombre, ''))) > 0
      );
  end if;
end $$;

-- ---------- Verificación ----------

do $$
declare v_cols int;
begin
  select count(*) into v_cols
  from information_schema.columns
  where table_schema = 'atlas'
    and table_name = 'programas_macro'
    and column_name in (
      'plan_estudios_archivo', 'plan_estudios_nombre',
      'plan_estudios_tamano', 'plan_estudios_subido_en',
      'plan_estudios_subido_por'
    );

  if v_cols <> 5 then
    raise exception 'Se esperaban 5 columnas del plan de estudios, hay %.', v_cols;
  end if;

  raise notice 'Plan de estudios en PDF: columnas listas. El archivo vive en el bucket atlas-documentos.';
end $$;

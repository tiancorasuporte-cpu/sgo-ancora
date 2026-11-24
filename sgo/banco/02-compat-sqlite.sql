-- SGO Âncora · compatibilidade com consultas de catálogo do SQLite (tela Configurações › Banco de dados)
SET search_path TO sgo, public;

CREATE OR REPLACE FUNCTION sgo.pragma_table_info(tabela text)
RETURNS TABLE(cid int, name text, type text, notnull int, dflt_value text, pk int)
LANGUAGE sql STABLE AS $$
  SELECT (a.attnum - 1)::int, a.attname::text, upper(format_type(a.atttypid, a.atttypmod))::text,
         a.attnotnull::int, pg_get_expr(d.adbin, d.adrelid)::text,
         COALESCE((SELECT array_position(i.indkey::int2[], a.attnum) FROM pg_index i WHERE i.indrelid = a.attrelid AND i.indisprimary), 0)::int
    FROM pg_attribute a
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
   WHERE a.attrelid = ('sgo.' || quote_ident(tabela))::regclass AND a.attnum > 0 AND NOT a.attisdropped
   ORDER BY a.attnum
$$;

CREATE OR REPLACE FUNCTION sgo.ddl_tabela(tabela text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT 'CREATE TABLE ' || tabela || ' (' || string_agg(
           p.name || ' ' || p.type || CASE WHEN p.notnull = 1 THEN ' NOT NULL' ELSE '' END ||
           CASE WHEN p.dflt_value IS NOT NULL AND p.dflt_value NOT LIKE 'nextval%' THEN ' DEFAULT ' || p.dflt_value ELSE '' END ||
           CASE WHEN p.pk > 0 THEN ' PRIMARY KEY' ELSE '' END, ', ' ORDER BY p.cid) || ')'
    FROM sgo.pragma_table_info(tabela) p
$$;

DROP VIEW IF EXISTS sgo.sgo_sqlite_master;
CREATE VIEW sgo.sgo_sqlite_master AS
SELECT CASE c.relkind WHEN 'r' THEN 'table' WHEN 'i' THEN 'index' ELSE 'view' END AS type,
       c.relname::text AS name,
       COALESCE(t.relname, c.relname)::text AS tbl_name,
       CASE c.relkind WHEN 'r' THEN sgo.ddl_tabela(c.relname::text)
                      WHEN 'i' THEN CASE WHEN ix.indisprimary OR ix.indisunique THEN NULL ELSE pg_get_indexdef(c.oid) END
       END AS sql
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_index ix ON ix.indexrelid = c.oid
  LEFT JOIN pg_class t ON t.oid = ix.indrelid
 WHERE n.nspname = 'sgo' AND c.relkind IN ('r','i','v') AND c.relname <> 'sgo_sqlite_master';

-- json_array_length do SQLite recebe texto
CREATE OR REPLACE FUNCTION sgo.json_array_length(t text) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN t IS NULL OR t = '' THEN NULL ELSE jsonb_array_length(t::jsonb) END
$$;

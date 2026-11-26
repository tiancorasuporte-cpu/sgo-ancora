-- Multi-setor, nível ver/usar e transições do Quadro de OS.
-- Também aplicado em runtime por src/sgo/server/instalar.ts (garantirExtrasUsuarios).

CREATE TABLE IF NOT EXISTS usuario_setores (
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  setor_id TEXT NOT NULL REFERENCES setores(id),
  PRIMARY KEY (usuario_id, setor_id)
);

INSERT INTO usuario_setores (usuario_id, setor_id)
  SELECT u.id, u.setor_id FROM usuarios u
  WHERE u.setor_id IS NOT NULL AND u.setor_id <> ''
    AND NOT EXISTS (
      SELECT 1 FROM usuario_setores x
      WHERE x.usuario_id = u.id AND x.setor_id = u.setor_id
    );

CREATE TABLE IF NOT EXISTS usuario_os_transicoes (
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  de SMALLINT NOT NULL CHECK (de BETWEEN 0 AND 7),
  para SMALLINT NOT NULL CHECK (para BETWEEN 0 AND 7),
  PRIMARY KEY (usuario_id, de, para)
);

-- nivel em usuario_permissoes: adicionado via ALTER no instalar.ts (Postgres).

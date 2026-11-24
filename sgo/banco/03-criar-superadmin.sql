-- Cria (ou redefine) o usuário superadmin do SGO com a senha provisória "trocar123".
-- Troque a senha no primeiro acesso (menu da conta › Trocar minha senha).
SET search_path TO sgo, public;
INSERT INTO usuarios (login, nome, perfil, senha_hash, senha_salt, senha_iter, ativo)
VALUES ('superadmin', 'Super Admin', 'superadmin',
        '15097d3d7441b8942b2f0a7440236712de63ac26d54b456177d4c47008777caa', '67774d400a9edcfbef0958dc8ee75b74', 100000, 1)
ON CONFLICT (login) DO UPDATE SET senha_hash = EXCLUDED.senha_hash, senha_salt = EXCLUDED.senha_salt,
  senha_iter = 100000, tentativas = 0, bloqueado_ate = 0, ativo = 1;

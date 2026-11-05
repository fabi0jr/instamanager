-- Retira as votações (IM-78). Exceção à regra aditiva: só roda com as tabelas vazias.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Votacao") OR EXISTS (SELECT 1 FROM "Voto") OR EXISTS (SELECT 1 FROM "Selo") THEN
    RAISE EXCEPTION 'IM-78: Votacao, Voto ou Selo têm linhas; migração abortada para não apagar dado';
  END IF;
END $$;

ALTER TABLE "Notificacao" DROP COLUMN "votacaoId";
DROP TABLE "Selo";
DROP TABLE "Voto";
DROP TABLE "Votacao";
DROP TYPE "VotacaoTipo";
-- NotificacaoTipo.VOTACAO_RESULTADO fica no enum: o Postgres não remove valor.

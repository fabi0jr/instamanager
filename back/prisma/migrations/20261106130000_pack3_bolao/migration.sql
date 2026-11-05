-- Aditiva: bolão (Palpite), preferências de push e controle do lembrete.
ALTER TABLE "User" ADD COLUMN "pushPrefs" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "Palpite" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "jogoId" UUID,
    "copaJogoId" UUID,
    "golsMandante" INTEGER NOT NULL,
    "golsVisitante" INTEGER NOT NULL,
    "classificadoId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Palpite_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Palpite_um_alvo" CHECK (("jogoId" IS NULL) <> ("copaJogoId" IS NULL))
);

CREATE TABLE "LembreteEnviado" (
    "tipo" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    CONSTRAINT "LembreteEnviado_pkey" PRIMARY KEY ("tipo","refId")
);

CREATE UNIQUE INDEX "Palpite_userId_jogoId_key" ON "Palpite"("userId", "jogoId");
CREATE UNIQUE INDEX "Palpite_userId_copaJogoId_key" ON "Palpite"("userId", "copaJogoId");

ALTER TABLE "Palpite" ADD CONSTRAINT "Palpite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Palpite" ADD CONSTRAINT "Palpite_jogoId_fkey" FOREIGN KEY ("jogoId") REFERENCES "Jogo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Palpite" ADD CONSTRAINT "Palpite_copaJogoId_fkey" FOREIGN KEY ("copaJogoId") REFERENCES "CopaJogo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

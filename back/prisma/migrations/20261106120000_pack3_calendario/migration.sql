-- Aditiva: jogo agendado (gols nulos), prazo de palpite e Copa do Brasil.
ALTER TABLE "Jogo" ALTER COLUMN "golsMandante" DROP NOT NULL, ALTER COLUMN "golsVisitante" DROP NOT NULL;
ALTER TABLE "Jogo" ADD CONSTRAINT "Jogo_placar_completo" CHECK (("golsMandante" IS NULL) = ("golsVisitante" IS NULL));
ALTER TABLE "Rodada" ADD COLUMN "prazoPalpite" TIMESTAMP(3);

CREATE TABLE "CopaFase" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "prazoPalpite" TIMESTAMP(3),
    "fechadaEm" TIMESTAMP(3),
    "resumoPostId" UUID,
    CONSTRAINT "CopaFase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CopaJogo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "faseId" UUID NOT NULL,
    "mandanteId" TEXT NOT NULL,
    "visitanteId" TEXT NOT NULL,
    "golsMandante" INTEGER,
    "golsVisitante" INTEGER,
    "penaltisMandante" INTEGER,
    "penaltisVisitante" INTEGER,
    CONSTRAINT "CopaJogo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CopaFase_ordem_key" ON "CopaFase"("ordem");
CREATE UNIQUE INDEX "CopaFase_resumoPostId_key" ON "CopaFase"("resumoPostId");
CREATE UNIQUE INDEX "CopaJogo_faseId_mandanteId_key" ON "CopaJogo"("faseId", "mandanteId");
CREATE UNIQUE INDEX "CopaJogo_faseId_visitanteId_key" ON "CopaJogo"("faseId", "visitanteId");

ALTER TABLE "CopaFase" ADD CONSTRAINT "CopaFase_resumoPostId_fkey" FOREIGN KEY ("resumoPostId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CopaJogo" ADD CONSTRAINT "CopaJogo_faseId_fkey" FOREIGN KEY ("faseId") REFERENCES "CopaFase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CopaJogo" ADD CONSTRAINT "CopaJogo_mandanteId_fkey" FOREIGN KEY ("mandanteId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CopaJogo" ADD CONSTRAINT "CopaJogo_visitanteId_fkey" FOREIGN KEY ("visitanteId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

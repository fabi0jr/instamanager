-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "oficial" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Rodada" (
    "numero" INTEGER NOT NULL,
    "fechadaEm" TIMESTAMP(3),

    CONSTRAINT "Rodada_pkey" PRIMARY KEY ("numero")
);

-- CreateTable
CREATE TABLE "Jogo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rodadaNumero" INTEGER NOT NULL,
    "mandanteId" TEXT NOT NULL,
    "visitanteId" TEXT NOT NULL,
    "golsMandante" INTEGER NOT NULL,
    "golsVisitante" INTEGER NOT NULL,

    CONSTRAINT "Jogo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Jogo_rodadaNumero_mandanteId_key" ON "Jogo"("rodadaNumero", "mandanteId");

-- CreateIndex
CREATE UNIQUE INDEX "Jogo_rodadaNumero_visitanteId_key" ON "Jogo"("rodadaNumero", "visitanteId");

-- AddForeignKey
ALTER TABLE "Jogo" ADD CONSTRAINT "Jogo_rodadaNumero_fkey" FOREIGN KEY ("rodadaNumero") REFERENCES "Rodada"("numero") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jogo" ADD CONSTRAINT "Jogo_mandanteId_fkey" FOREIGN KEY ("mandanteId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jogo" ADD CONSTRAINT "Jogo_visitanteId_fkey" FOREIGN KEY ("visitanteId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 38 rodadas (pontos corridos, 20 clubes) e a CBF, o clube oficial
INSERT INTO "Rodada" ("numero") SELECT generate_series(1, 38);
INSERT INTO "Club" ("id", "name", "crestPath", "oficial") VALUES ('cbf', 'CBF', '/escudos/cbf.svg', true) ON CONFLICT ("id") DO NOTHING;

-- CreateEnum
CREATE TYPE "VotacaoTipo" AS ENUM ('CLUBE', 'TECNICO', 'POST');

-- CreateTable
CREATE TABLE "Votacao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "titulo" TEXT NOT NULL,
    "tipo" "VotacaoTipo" NOT NULL,
    "opcoes" JSONB NOT NULL,
    "prazo" TIMESTAMP(3) NOT NULL,
    "encerradaEm" TIMESTAMP(3),
    "criadaPor" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Votacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voto" (
    "votacaoId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "opcao" TEXT NOT NULL,

    CONSTRAINT "Voto_pkey" PRIMARY KEY ("votacaoId","userId")
);

-- CreateTable
CREATE TABLE "Selo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clubId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "votacaoId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Selo_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Votacao" ADD CONSTRAINT "Votacao_criadaPor_fkey" FOREIGN KEY ("criadaPor") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voto" ADD CONSTRAINT "Voto_votacaoId_fkey" FOREIGN KEY ("votacaoId") REFERENCES "Votacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voto" ADD CONSTRAINT "Voto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Selo" ADD CONSTRAINT "Selo_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Selo" ADD CONSTRAINT "Selo_votacaoId_fkey" FOREIGN KEY ("votacaoId") REFERENCES "Votacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;


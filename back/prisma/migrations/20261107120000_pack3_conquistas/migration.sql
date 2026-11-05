-- Pack 3 onda B: conquistas e níveis. Só acrescenta (nada existente muda).
-- CreateEnum
CREATE TYPE "ConquistaTipo" AS ENUM ('PRIMEIRA_VITORIA', 'GOLEADA', 'INVICTO_5', 'LIDER', 'CAMPEAO_COPA', 'REI_BOLAO', 'PRIMEIRO_STORY', 'COMUNICADOR');

-- AlterEnum
ALTER TYPE "NotificacaoTipo" ADD VALUE 'CONQUISTA';
ALTER TYPE "NotificacaoTipo" ADD VALUE 'RESPOSTA';

-- AlterTable
ALTER TABLE "Notificacao" ADD COLUMN "conquistaTipo" "ConquistaTipo";

-- CreateTable
CREATE TABLE "Conquista" (
    "userId" UUID NOT NULL,
    "tipo" "ConquistaTipo" NOT NULL,
    "refId" TEXT NOT NULL DEFAULT '',
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conquista_pkey" PRIMARY KEY ("userId","tipo","refId")
);

-- AddForeignKey
ALTER TABLE "Conquista" ADD CONSTRAINT "Conquista_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

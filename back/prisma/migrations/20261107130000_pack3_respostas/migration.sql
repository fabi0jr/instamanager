-- Pack 3 onda B: responder comentário (um nível só). Só acrescenta.
-- IF NOT EXISTS: a migração das conquistas (IM-61) também cria o valor RESPOSTA, e a ordem do merge não pode importar.
ALTER TYPE "NotificacaoTipo" ADD VALUE IF NOT EXISTS 'RESPOSTA';

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN "parentId" UUID;

-- CreateIndex
CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

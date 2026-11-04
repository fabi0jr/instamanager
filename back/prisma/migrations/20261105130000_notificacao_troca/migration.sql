-- AlterTable
ALTER TABLE "Notificacao" ADD COLUMN     "trocaId" UUID;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_trocaId_fkey" FOREIGN KEY ("trocaId") REFERENCES "TransferRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

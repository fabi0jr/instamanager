-- AlterTable
ALTER TABLE "Rodada" ADD COLUMN     "resumoPostId" UUID;

-- AddForeignKey
ALTER TABLE "Rodada" ADD CONSTRAINT "Rodada_resumoPostId_fkey" FOREIGN KEY ("resumoPostId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

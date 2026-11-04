-- Só aditiva: curtidas existentes viram reação ❤️ pelo default, sem script de conversão.
-- AlterTable
ALTER TABLE "Like" ADD COLUMN     "emoji" TEXT NOT NULL DEFAULT '❤️';

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "pinnedAt" TIMESTAMP(3),
ADD COLUMN     "texto" TEXT;

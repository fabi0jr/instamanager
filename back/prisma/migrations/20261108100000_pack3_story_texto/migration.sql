-- Story de texto: aditivo. Os stories antigos seguem como estão.
ALTER TYPE "StoryTipo" ADD VALUE IF NOT EXISTS 'TEXTO';

ALTER TABLE "Story" ALTER COLUMN "path" DROP NOT NULL,
ALTER COLUMN "largura" DROP NOT NULL,
ALTER COLUMN "altura" DROP NOT NULL,
ADD COLUMN "texto" TEXT,
ADD COLUMN "fundo" TEXT;

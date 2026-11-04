-- CreateEnum
CREATE TYPE "StoryTipo" AS ENUM ('IMAGEM', 'VIDEO');

-- CreateTable
CREATE TABLE "Story" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clubId" TEXT NOT NULL,
    "autorId" UUID NOT NULL,
    "tipo" "StoryTipo" NOT NULL,
    "path" TEXT NOT NULL,
    "capaPath" TEXT,
    "duracaoS" DOUBLE PRECISION,
    "largura" INTEGER NOT NULL,
    "altura" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryVisto" (
    "storyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "vistoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryVisto_pkey" PRIMARY KEY ("storyId","userId")
);

-- CreateTable
CREATE TABLE "PostVideo" (
    "postId" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "capaPath" TEXT NOT NULL,
    "duracaoS" DOUBLE PRECISION NOT NULL,
    "largura" INTEGER NOT NULL,
    "altura" INTEGER NOT NULL,

    CONSTRAINT "PostVideo_pkey" PRIMARY KEY ("postId")
);

-- CreateIndex
CREATE INDEX "Story_expiraEm_idx" ON "Story"("expiraEm");

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryVisto" ADD CONSTRAINT "StoryVisto_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryVisto" ADD CONSTRAINT "StoryVisto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostVideo" ADD CONSTRAINT "PostVideo_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

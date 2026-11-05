-- Log das ações de escrita da CBF via MCP. Aditivo.
CREATE TABLE "McpAcao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ferramenta" TEXT NOT NULL,
    "entrada" JSONB NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "erro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpAcao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "McpAcao_createdAt_idx" ON "McpAcao"("createdAt");

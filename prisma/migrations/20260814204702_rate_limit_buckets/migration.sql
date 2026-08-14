-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "chave" VARCHAR(160) NOT NULL,
    "janelaInicio" BIGINT NOT NULL,
    "contagem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("chave","janelaInicio")
);

-- CreateIndex
CREATE INDEX "rate_limit_buckets_janelaInicio_idx" ON "rate_limit_buckets"("janelaInicio");

-- CreateTable
CREATE TABLE "chat_histories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_histories_user_id_idx" ON "chat_histories"("user_id");

-- AddForeignKey
ALTER TABLE "chat_histories" ADD CONSTRAINT "chat_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

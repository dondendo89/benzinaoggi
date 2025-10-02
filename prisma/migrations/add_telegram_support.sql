-- Migration per supporto Telegram Bot
-- Eseguire questo script sul database PostgreSQL

-- Tabella per gli utenti Telegram
CREATE TABLE IF NOT EXISTS "TelegramUser" (
    "id" SERIAL PRIMARY KEY,
    "telegramId" BIGINT NOT NULL UNIQUE,
    "chatId" BIGINT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "username" TEXT,
    "languageCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabella per le iscrizioni alle notifiche Telegram
CREATE TABLE IF NOT EXISTS "TelegramSubscription" (
    "id" SERIAL PRIMARY KEY,
    "telegramId" BIGINT NOT NULL,
    "type" TEXT NOT NULL, -- 'ALL', 'CITY', 'STATION'
    "impiantoId" INTEGER,
    "fuelType" TEXT,
    "city" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraint per evitare duplicati
    CONSTRAINT "TelegramSubscription_telegramId_type_key" UNIQUE("telegramId", "type", "impiantoId", "fuelType", "city")
);

-- Tabella per log dei messaggi Telegram (opzionale, per debug)
CREATE TABLE IF NOT EXISTS "TelegramMessage" (
    "id" SERIAL PRIMARY KEY,
    "telegramId" BIGINT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "text" TEXT,
    "command" TEXT,
    "isIncoming" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS "TelegramUser_telegramId_idx" ON "TelegramUser"("telegramId");
CREATE INDEX IF NOT EXISTS "TelegramUser_isActive_idx" ON "TelegramUser"("isActive");

CREATE INDEX IF NOT EXISTS "TelegramSubscription_telegramId_idx" ON "TelegramSubscription"("telegramId");
CREATE INDEX IF NOT EXISTS "TelegramSubscription_isActive_idx" ON "TelegramSubscription"("isActive");
CREATE INDEX IF NOT EXISTS "TelegramSubscription_type_idx" ON "TelegramSubscription"("type");
CREATE INDEX IF NOT EXISTS "TelegramSubscription_impiantoId_idx" ON "TelegramSubscription"("impiantoId");

CREATE INDEX IF NOT EXISTS "TelegramMessage_telegramId_idx" ON "TelegramMessage"("telegramId");
CREATE INDEX IF NOT EXISTS "TelegramMessage_createdAt_idx" ON "TelegramMessage"("createdAt");

-- Aggiorna il timestamp automaticamente
CREATE OR REPLACE FUNCTION update_telegram_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS update_telegram_subscription_updated_at
    BEFORE UPDATE ON "TelegramSubscription"
    FOR EACH ROW
    EXECUTE FUNCTION update_telegram_subscription_timestamp();

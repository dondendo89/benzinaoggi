-- CreateTable
CREATE TABLE "Distributor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "impiantoId" INTEGER NOT NULL,
    "gestore" TEXT,
    "bandiera" TEXT,
    "comune" TEXT,
    "provincia" TEXT,
    "indirizzo" TEXT,
    "latitudine" REAL,
    "longitudine" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Price" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "distributorId" INTEGER NOT NULL,
    "fuelType" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "isSelfService" BOOLEAN NOT NULL DEFAULT false,
    "communicatedAt" DATETIME NOT NULL,
    "day" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Price_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Distributor_impiantoId_key" ON "Distributor"("impiantoId");

-- CreateIndex
CREATE INDEX "Distributor_comune_idx" ON "Distributor"("comune");

-- CreateIndex
CREATE INDEX "Distributor_provincia_idx" ON "Distributor"("provincia");

-- CreateIndex
CREATE INDEX "Distributor_bandiera_idx" ON "Distributor"("bandiera");

-- CreateIndex
CREATE INDEX "Price_day_idx" ON "Price"("day");

-- CreateIndex
CREATE INDEX "Price_fuelType_day_idx" ON "Price"("fuelType", "day");

-- CreateIndex
CREATE UNIQUE INDEX "Price_distributorId_fuelType_day_isSelfService_key" ON "Price"("distributorId", "fuelType", "day", "isSelfService");

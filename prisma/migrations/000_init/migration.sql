-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'DATA_ENTRY_OPERATOR');
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');
CREATE TYPE "BloodGroup" AS ENUM ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG', 'UNKNOWN');
CREATE TYPE "OcrStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVIEW');
CREATE TYPE "DocumentType" AS ENUM ('ADMISSION_FORM', 'BIRTH_CERTIFICATE', 'TRANSFER_CERTIFICATE', 'MARK_SHEET', 'PHOTO', 'AADHAR', 'OTHER');

-- CreateTable: users
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'DATA_ENTRY_OPERATOR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateTable: students
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "admissionNumber" TEXT NOT NULL,
    "admissionDate" TIMESTAMP(3) NOT NULL,
    "studentName" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "bloodGroup" "BloodGroup" NOT NULL DEFAULT 'UNKNOWN',
    "aadharNumber" TEXT,
    "className" TEXT NOT NULL,
    "section" TEXT,
    "academicYear" TEXT NOT NULL,
    "religion" TEXT,
    "caste" TEXT,
    "previousSchool" TEXT,
    "tcNumber" TEXT,
    "remarks" TEXT,
    "photoUrl" TEXT,
    "qrCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "students_admissionNumber_key" ON "students"("admissionNumber");
CREATE UNIQUE INDEX "students_aadharNumber_key" ON "students"("aadharNumber");
CREATE INDEX "students_studentName_idx" ON "students"("studentName");
CREATE INDEX "students_admissionNumber_idx" ON "students"("admissionNumber");
CREATE INDEX "students_className_idx" ON "students"("className");
CREATE INDEX "students_academicYear_idx" ON "students"("academicYear");
CREATE INDEX "students_aadharNumber_idx" ON "students"("aadharNumber");

-- CreateTable: parents
CREATE TABLE "parents" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fatherName" TEXT,
    "motherName" TEXT,
    "guardianName" TEXT,
    "phone" TEXT,
    "alternatePhone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "district" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "occupation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "parents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "parents_studentId_idx" ON "parents"("studentId");
CREATE INDEX "parents_fatherName_idx" ON "parents"("fatherName");
CREATE INDEX "parents_motherName_idx" ON "parents"("motherName");
CREATE INDEX "parents_phone_idx" ON "parents"("phone");

-- CreateTable: documents
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL DEFAULT 'ADMISSION_FORM',
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "processedPath" TEXT,
    "ocrText" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "documents_studentId_idx" ON "documents"("studentId");

-- CreateTable: ocr_jobs
CREATE TABLE "ocr_jobs" (
    "id" TEXT NOT NULL,
    "documentId" TEXT,
    "studentId" TEXT,
    "userId" TEXT NOT NULL,
    "status" "OcrStatus" NOT NULL DEFAULT 'PENDING',
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "rawText" TEXT,
    "extractedData" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ocr_jobs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ocr_jobs_documentId_key" ON "ocr_jobs"("documentId");
CREATE INDEX "ocr_jobs_status_idx" ON "ocr_jobs"("status");
CREATE INDEX "ocr_jobs_userId_idx" ON "ocr_jobs"("userId");
CREATE INDEX "ocr_jobs_studentId_idx" ON "ocr_jobs"("studentId");

-- CreateTable: audit_logs
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studentId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldData" JSONB,
    "newData" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX "audit_logs_studentId_idx" ON "audit_logs"("studentId");
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs"("entity");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateTable: exports
CREATE TABLE "exports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exportType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "filters" JSONB,
    "rowCount" INTEGER,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "exports_userId_idx" ON "exports"("userId");

-- CreateTable: backups
CREATE TABLE "backups" (
    "id" TEXT NOT NULL,
    "backupType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileSize" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "backups_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "parents" ADD CONSTRAINT "parents_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ocr_jobs" ADD CONSTRAINT "ocr_jobs_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ocr_jobs" ADD CONSTRAINT "ocr_jobs_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ocr_jobs" ADD CONSTRAINT "ocr_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exports" ADD CONSTRAINT "exports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

/*
  Warnings:

  - Added the required column `method` to the `job_imports` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `idx_job_sources_type_active` ON `job_sources`;

-- AlterTable
ALTER TABLE `audit_logs` MODIFY `action` ENUM('LOGIN', 'CREATE', 'UPDATE', 'ARCHIVE', 'PUBLISH', 'UNPUBLISH', 'FEATURE', 'UNFEATURE', 'UPLOAD', 'IMPORT', 'APPROVE', 'REJECT', 'EXPIRE', 'SYNC') NOT NULL;

-- AlterTable
ALTER TABLE `job_imports` ADD COLUMN `columnMapping` JSON NULL,
    ADD COLUMN `method` ENUM('CSV', 'API', 'RSS') NOT NULL DEFAULT 'CSV',
    ADD COLUMN `sourceUrl` TEXT NULL;

-- AlterTable
ALTER TABLE `job_sources` ADD COLUMN `approvedAt` DATETIME(3) NULL,
    ADD COLUMN `attributionText` VARCHAR(255) NULL,
    ADD COLUMN `feedUrl` TEXT NULL,
    ADD COLUMN `permissionNotes` TEXT NULL,
    ADD COLUMN `permissionStatus` ENUM('PENDING_REVIEW', 'APPROVED', 'SUSPENDED', 'REVOKED') NOT NULL DEFAULT 'PENDING_REVIEW';

-- Existing manual entry is first-party and does not need third-party permission review.
UPDATE `job_sources`
SET `permissionStatus` = 'APPROVED', `approvedAt` = CURRENT_TIMESTAMP(3)
WHERE `type` = 'MANUAL';

-- AlterTable
ALTER TABLE `jobs` ADD COLUMN `originalPublishedAt` DATETIME(3) NULL,
    ADD COLUMN `verificationStatus` ENUM('UNVERIFIED', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'UNVERIFIED',
    ADD COLUMN `verifiedAt` DATETIME(3) NULL,
    ADD COLUMN `verifiedById` VARCHAR(30) NULL;

-- CreateTable
CREATE TABLE `job_import_rows` (
    `id` VARCHAR(30) NOT NULL,
    `jobImportId` VARCHAR(30) NOT NULL,
    `rowNumber` INTEGER UNSIGNED NOT NULL,
    `status` ENUM('PENDING', 'VALID', 'DUPLICATE', 'INVALID', 'IMPORTED') NOT NULL DEFAULT 'PENDING',
    `rawData` JSON NOT NULL,
    `normalizedData` JSON NULL,
    `errorMessages` JSON NULL,
    `duplicateJobId` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `idx_job_import_rows_import_status_row`(`jobImportId`, `status`, `rowNumber`),
    INDEX `idx_job_import_rows_duplicate_job`(`duplicateJobId`),
    UNIQUE INDEX `uq_job_import_rows_import_row`(`jobImportId`, `rowNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `idx_job_sources_type_active_permission` ON `job_sources`(`type`, `isActive`, `permissionStatus`);

-- CreateIndex
CREATE INDEX `idx_jobs_verification_status` ON `jobs`(`verificationStatus`, `status`);

-- CreateIndex
CREATE INDEX `idx_jobs_verified_by` ON `jobs`(`verifiedById`);

-- AddForeignKey
ALTER TABLE `job_import_rows` ADD CONSTRAINT `job_import_rows_jobImportId_fkey` FOREIGN KEY (`jobImportId`) REFERENCES `job_imports`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_import_rows` ADD CONSTRAINT `job_import_rows_duplicateJobId_fkey` FOREIGN KEY (`duplicateJobId`) REFERENCES `jobs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_verifiedById_fkey` FOREIGN KEY (`verifiedById`) REFERENCES `admins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

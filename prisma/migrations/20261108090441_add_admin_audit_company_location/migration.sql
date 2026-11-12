-- AlterTable
ALTER TABLE `companies` ADD COLUMN `locationId` VARCHAR(30) NULL;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(30) NOT NULL,
    `adminId` VARCHAR(30) NULL,
    `action` ENUM('LOGIN', 'CREATE', 'UPDATE', 'ARCHIVE', 'PUBLISH', 'UNPUBLISH', 'FEATURE', 'UNFEATURE', 'UPLOAD') NOT NULL,
    `entityType` VARCHAR(80) NOT NULL,
    `entityId` VARCHAR(30) NULL,
    `summary` VARCHAR(255) NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_audit_logs_admin_created`(`adminId`, `createdAt`),
    INDEX `idx_audit_logs_entity_created`(`entityType`, `entityId`, `createdAt`),
    INDEX `idx_audit_logs_action_created`(`action`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `idx_companies_location` ON `companies`(`locationId`);

-- AddForeignKey
ALTER TABLE `companies` ADD CONSTRAINT `companies_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `job_locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `admins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

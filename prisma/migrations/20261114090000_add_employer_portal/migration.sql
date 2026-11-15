-- AlterTable
ALTER TABLE `jobs` ADD COLUMN `postedByEmployerId` VARCHAR(30) NULL,
    MODIFY `applicationMethod` ENUM('EXTERNAL_URL', 'EMAIL', 'INSTRUCTIONS', 'ON_SITE') NOT NULL;

-- CreateTable
CREATE TABLE `employer_users` (
    `id` VARCHAR(30) NOT NULL,
    `companyId` VARCHAR(30) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `passwordHash` VARCHAR(255) NULL,
    `role` ENUM('OWNER', 'RECRUITER') NOT NULL DEFAULT 'RECRUITER',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `setupTokenHash` CHAR(64) NULL,
    `setupTokenExpiresAt` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_employer_users_email`(`email`),
    UNIQUE INDEX `uq_employer_users_setup_token`(`setupTokenHash`),
    INDEX `idx_employer_users_company_active`(`companyId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_applications` (
    `id` VARCHAR(30) NOT NULL,
    `jobId` VARCHAR(30) NOT NULL,
    `companyId` VARCHAR(30) NOT NULL,
    `fullName` VARCHAR(120) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(30) NOT NULL,
    `city` VARCHAR(120) NULL,
    `coverLetter` TEXT NULL,
    `cvStorageKey` VARCHAR(255) NOT NULL,
    `cvFileName` VARCHAR(255) NOT NULL,
    `cvMimeType` VARCHAR(100) NOT NULL,
    `cvSizeBytes` INTEGER UNSIGNED NOT NULL,
    `status` ENUM('NEW', 'REVIEWING', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'HIRED', 'REJECTED') NOT NULL DEFAULT 'NEW',
    `employerNotes` TEXT NULL,
    `viewedAt` DATETIME(3) NULL,
    `statusChangedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `idx_job_applications_company_status_created`(`companyId`, `status`, `createdAt`),
    INDEX `idx_job_applications_job_status_created`(`jobId`, `status`, `createdAt`),
    INDEX `idx_job_applications_created`(`createdAt`),
    UNIQUE INDEX `uq_job_applications_job_email`(`jobId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `idx_jobs_posted_by_employer` ON `jobs`(`postedByEmployerId`);

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_postedByEmployerId_fkey` FOREIGN KEY (`postedByEmployerId`) REFERENCES `employer_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employer_users` ADD CONSTRAINT `employer_users_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_applications` ADD CONSTRAINT `job_applications_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_applications` ADD CONSTRAINT `job_applications_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

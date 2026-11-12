-- Salary frequency is required before genuine salary values can be emitted as JobPosting baseSalary.
ALTER TABLE `jobs`
ADD COLUMN `salaryPeriod` ENUM('HOUR', 'DAY', 'WEEK', 'MONTH', 'YEAR') NULL;

-- Preserve canonical continuity when an administrator changes a job slug.
CREATE TABLE `job_slug_redirects` (
    `id` VARCHAR(30) NOT NULL,
    `oldSlug` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_job_slug_redirects_old_slug`(`oldSlug`),
    INDEX `idx_job_slug_redirects_job`(`jobId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `job_slug_redirects`
ADD CONSTRAINT `job_slug_redirects_jobId_fkey`
FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

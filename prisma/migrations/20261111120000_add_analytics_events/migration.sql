-- Privacy-minimized first-party launch analytics. No IP address, user-agent, email, or raw search text is stored.
CREATE TABLE `analytics_events` (
    `id` VARCHAR(30) NOT NULL,
    `type` ENUM('JOB_VIEW', 'APPLICATION_LINK_CLICK', 'SEARCH', 'FILTER') NOT NULL,
    `jobId` VARCHAR(30) NULL,
    `path` VARCHAR(255) NOT NULL,
    `locationSlug` VARCHAR(191) NULL,
    `categorySlug` VARCHAR(191) NULL,
    `filterCount` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `metadata` JSON NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `idx_analytics_type_occurred`(`type`, `occurredAt`),
    INDEX `idx_analytics_job_type_occurred`(`jobId`, `type`, `occurredAt`),
    INDEX `idx_analytics_location_type_occurred`(`locationSlug`, `type`, `occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `analytics_events`
    ADD CONSTRAINT `analytics_events_jobId_fkey`
    FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

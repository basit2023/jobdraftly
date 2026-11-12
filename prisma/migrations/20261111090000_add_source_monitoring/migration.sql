-- Phase 8: authorized source monitoring, change history, extraction queue, and admin notifications.
ALTER TABLE `job_sources`
    ADD COLUMN `monitoringMode` ENUM('DISABLED', 'API', 'RSS', 'WEB_PAGE') NOT NULL DEFAULT 'DISABLED',
    ADD COLUMN `monitoringEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `monitoringIntervalMinutes` INTEGER UNSIGNED NOT NULL DEFAULT 1440,
    ADD COLUMN `rateLimitPerMinute` INTEGER UNSIGNED NOT NULL DEFAULT 6,
    ADD COLUMN `lastScanAt` DATETIME(3) NULL,
    ADD COLUMN `lastSuccessfulScanAt` DATETIME(3) NULL,
    ADD COLUMN `nextScanAt` DATETIME(3) NULL,
    ADD COLUMN `lastFailureAt` DATETIME(3) NULL,
    ADD COLUMN `consecutiveFailures` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN `lastMonitorError` TEXT NULL,
    ADD COLUMN `monitorEtag` VARCHAR(255) NULL,
    ADD COLUMN `monitorLastModified` VARCHAR(255) NULL,
    ADD COLUMN `monitorLeaseUntil` DATETIME(3) NULL;

CREATE INDEX `idx_job_sources_monitoring_due`
ON `job_sources`(`monitoringEnabled`, `nextScanAt`);

CREATE TABLE `source_monitor_runs` (
    `id` VARCHAR(30) NOT NULL,
    `sourceId` VARCHAR(30) NOT NULL,
    `status` ENUM('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'RUNNING',
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `responseStatus` SMALLINT UNSIGNED NULL,
    `discoveredCount` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `changedCount` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `removedCount` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `documentCount` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `errorMessage` TEXT NULL,
    `metadata` JSON NULL,
    INDEX `idx_source_monitor_runs_source_started`(`sourceId`, `startedAt`),
    INDEX `idx_source_monitor_runs_status_started`(`status`, `startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `source_discoveries` (
    `id` VARCHAR(30) NOT NULL,
    `sourceId` VARCHAR(30) NOT NULL,
    `relatedJobId` VARCHAR(30) NULL,
    `externalKey` CHAR(64) NOT NULL,
    `externalId` VARCHAR(191) NULL,
    `canonicalUrl` TEXT NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `summary` LONGTEXT NULL,
    `type` ENUM('JOB', 'ANNOUNCEMENT', 'TEST_INTERVIEW', 'RESULT_MERIT_LIST', 'DOCUMENT', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `status` ENUM('NEW', 'UPDATED', 'REMOVED', 'REVIEWED', 'DISMISSED') NOT NULL DEFAULT 'NEW',
    `latestChangeType` ENUM('NEW_CONTENT', 'CONTENT_UPDATED', 'DEADLINE_CHANGED', 'CANCELLED', 'REMOVED', 'RESTORED', 'CORRECTION', 'POSSIBLE_DUPLICATE') NOT NULL DEFAULT 'NEW_CONTENT',
    `fingerprint` CHAR(64) NOT NULL,
    `sourcePublishedAt` DATETIME(3) NULL,
    `deadline` DATETIME(3) NULL,
    `firstSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `missingScans` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `removedAt` DATETIME(3) NULL,
    `rawPayload` JSON NULL,
    `extractionStatus` ENUM('NOT_REQUIRED', 'NOT_CONFIGURED', 'PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED') NOT NULL DEFAULT 'NOT_REQUIRED',
    `confidenceScore` DECIMAL(5, 4) NULL,
    `extractedData` JSON NULL,
    `extractionError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `uq_source_discoveries_source_key`(`sourceId`, `externalKey`),
    INDEX `idx_source_discoveries_status_type_created`(`status`, `type`, `createdAt`),
    INDEX `idx_source_discoveries_source_seen`(`sourceId`, `lastSeenAt`),
    INDEX `idx_source_discoveries_related_job`(`relatedJobId`),
    INDEX `idx_source_discoveries_extraction_created`(`extractionStatus`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `source_discovery_versions` (
    `id` VARCHAR(30) NOT NULL,
    `discoveryId` VARCHAR(30) NOT NULL,
    `monitorRunId` VARCHAR(30) NULL,
    `changeType` ENUM('NEW_CONTENT', 'CONTENT_UPDATED', 'DEADLINE_CHANGED', 'CANCELLED', 'REMOVED', 'RESTORED', 'CORRECTION', 'POSSIBLE_DUPLICATE') NOT NULL,
    `fingerprint` CHAR(64) NOT NULL,
    `snapshot` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `idx_source_discovery_versions_discovery_created`(`discoveryId`, `createdAt`),
    INDEX `idx_source_discovery_versions_run`(`monitorRunId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `source_documents` (
    `id` VARCHAR(30) NOT NULL,
    `discoveryId` VARCHAR(30) NOT NULL,
    `urlHash` CHAR(64) NOT NULL,
    `url` TEXT NOT NULL,
    `documentReference` VARCHAR(255) NULL,
    `mimeType` VARCHAR(120) NULL,
    `extractionStatus` ENUM('NOT_REQUIRED', 'NOT_CONFIGURED', 'PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED') NOT NULL DEFAULT 'NOT_CONFIGURED',
    `confidenceScore` DECIMAL(5, 4) NULL,
    `extractedData` JSON NULL,
    `extractionError` TEXT NULL,
    `discoveredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processedAt` DATETIME(3) NULL,
    UNIQUE INDEX `uq_source_documents_discovery_hash`(`discoveryId`, `urlHash`),
    INDEX `idx_source_documents_extraction_discovered`(`extractionStatus`, `discoveredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `admin_notifications` (
    `id` VARCHAR(30) NOT NULL,
    `type` ENUM('NEW_JOB', 'NEW_ANNOUNCEMENT', 'SOURCE_FAILURE', 'EXTRACTION_FAILURE', 'DEADLINE_CHANGE', 'POSSIBLE_DUPLICATE') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `entityType` VARCHAR(80) NOT NULL,
    `entityId` VARCHAR(30) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `idx_admin_notifications_read_created`(`readAt`, `createdAt`),
    INDEX `idx_admin_notifications_type_created`(`type`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `source_monitor_runs`
ADD CONSTRAINT `source_monitor_runs_sourceId_fkey`
FOREIGN KEY (`sourceId`) REFERENCES `job_sources`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `source_discoveries`
ADD CONSTRAINT `source_discoveries_sourceId_fkey`
FOREIGN KEY (`sourceId`) REFERENCES `job_sources`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `source_discoveries`
ADD CONSTRAINT `source_discoveries_relatedJobId_fkey`
FOREIGN KEY (`relatedJobId`) REFERENCES `jobs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `source_discovery_versions`
ADD CONSTRAINT `source_discovery_versions_discoveryId_fkey`
FOREIGN KEY (`discoveryId`) REFERENCES `source_discoveries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `source_discovery_versions`
ADD CONSTRAINT `source_discovery_versions_monitorRunId_fkey`
FOREIGN KEY (`monitorRunId`) REFERENCES `source_monitor_runs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `source_documents`
ADD CONSTRAINT `source_documents_discoveryId_fkey`
FOREIGN KEY (`discoveryId`) REFERENCES `source_discoveries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `admins` (
    `id` VARCHAR(30) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'ADMIN', 'EDITOR') NOT NULL DEFAULT 'EDITOR',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_admins_email`(`email`),
    INDEX `idx_admins_active_role`(`isActive`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `companies` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `legalName` VARCHAR(191) NULL,
    `websiteUrl` TEXT NULL,
    `domain` VARCHAR(191) NULL,
    `logoUrl` TEXT NULL,
    `description` LONGTEXT NULL,
    `industry` VARCHAR(120) NULL,
    `isVerified` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_companies_slug`(`slug`),
    UNIQUE INDEX `uq_companies_domain`(`domain`),
    INDEX `idx_companies_name`(`name`),
    INDEX `idx_companies_active_verified`(`isActive`, `isVerified`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_categories` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `parentId` VARCHAR(30) NULL,
    `sortOrder` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_job_categories_slug`(`slug`),
    INDEX `idx_job_categories_parent_sort`(`parentId`, `sortOrder`),
    INDEX `idx_job_categories_active_sort`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_locations` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `type` ENUM('PROVINCE', 'CITY') NOT NULL,
    `provinceId` VARCHAR(30) NULL,
    `latitude` DECIMAL(9, 6) NULL,
    `longitude` DECIMAL(9, 6) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_job_locations_slug`(`slug`),
    INDEX `idx_job_locations_type_active_sort`(`type`, `isActive`, `sortOrder`),
    UNIQUE INDEX `uq_job_locations_parent_name_type`(`provinceId`, `name`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_sources` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `type` ENUM('MANUAL', 'CSV', 'XML_FEED', 'API', 'EMPLOYER_WEBSITE', 'JOB_BOARD', 'GOVERNMENT_PORTAL') NOT NULL,
    `baseUrl` TEXT NULL,
    `termsUrl` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastSyncAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_job_sources_slug`(`slug`),
    INDEX `idx_job_sources_type_active`(`type`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_imports` (
    `id` VARCHAR(30) NOT NULL,
    `sourceId` VARCHAR(30) NOT NULL,
    `uploadedById` VARCHAR(30) NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `fileChecksum` CHAR(64) NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `totalRows` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `importedRows` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `duplicateRows` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `rejectedRows` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `errorSummary` JSON NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_job_imports_checksum`(`fileChecksum`),
    INDEX `idx_job_imports_source_status_created`(`sourceId`, `status`, `createdAt`),
    INDEX `idx_job_imports_uploaded_by`(`uploadedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `jobs` (
    `id` VARCHAR(30) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(30) NOT NULL,
    `categoryId` VARCHAR(30) NOT NULL,
    `locationId` VARCHAR(30) NOT NULL,
    `description` LONGTEXT NOT NULL,
    `responsibilities` LONGTEXT NULL,
    `requirements` LONGTEXT NULL,
    `skills` TEXT NULL,
    `employmentType` ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERNSHIP', 'FREELANCE', 'OTHER') NOT NULL,
    `experienceLevel` ENUM('NOT_SPECIFIED', 'ENTRY_LEVEL', 'JUNIOR', 'MID_LEVEL', 'SENIOR', 'LEAD', 'MANAGER', 'DIRECTOR', 'EXECUTIVE') NOT NULL DEFAULT 'NOT_SPECIFIED',
    `education` VARCHAR(191) NULL,
    `salaryMin` DECIMAL(12, 2) NULL,
    `salaryMax` DECIMAL(12, 2) NULL,
    `salaryCurrency` CHAR(3) NOT NULL DEFAULT 'PKR',
    `salaryVisibility` ENUM('HIDDEN', 'RANGE', 'EXACT', 'NEGOTIABLE') NOT NULL DEFAULT 'HIDDEN',
    `workplaceType` ENUM('ONSITE', 'HYBRID', 'REMOTE') NOT NULL,
    `applicationMethod` ENUM('EXTERNAL_URL', 'EMAIL', 'INSTRUCTIONS') NOT NULL,
    `applicationUrl` TEXT NULL,
    `sourceId` VARCHAR(30) NULL,
    `sourceUrl` TEXT NULL,
    `sourceExternalId` VARCHAR(191) NULL,
    `sourceUrlHash` CHAR(64) NULL,
    `deduplicationKey` CHAR(64) NOT NULL,
    `jobImportId` VARCHAR(30) NULL,
    `publishedAt` DATETIME(3) NULL,
    `applicationDeadline` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'EXPIRED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_jobs_slug`(`slug`),
    UNIQUE INDEX `uq_jobs_deduplication_key`(`deduplicationKey`),
    INDEX `idx_jobs_status_published`(`status`, `publishedAt`),
    INDEX `idx_jobs_category_status_published`(`categoryId`, `status`, `publishedAt`),
    INDEX `idx_jobs_location_status_published`(`locationId`, `status`, `publishedAt`),
    INDEX `idx_jobs_company_status_published`(`companyId`, `status`, `publishedAt`),
    INDEX `idx_jobs_type_workplace_status`(`employmentType`, `workplaceType`, `status`),
    INDEX `idx_jobs_featured_status_published`(`isFeatured`, `status`, `publishedAt`),
    INDEX `idx_jobs_expiry_status`(`expiresAt`, `status`),
    INDEX `idx_jobs_import`(`jobImportId`),
    UNIQUE INDEX `uq_jobs_source_external_id`(`sourceId`, `sourceExternalId`),
    UNIQUE INDEX `uq_jobs_source_url_hash`(`sourceId`, `sourceUrlHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_tags` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_job_tags_slug`(`slug`),
    UNIQUE INDEX `uq_job_tags_name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_tag_assignments` (
    `jobId` VARCHAR(30) NOT NULL,
    `tagId` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_job_tag_assignments_tag_job`(`tagId`, `jobId`),
    PRIMARY KEY (`jobId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddCheckConstraints
ALTER TABLE `jobs`
    ADD CONSTRAINT `chk_jobs_salary_min_non_negative`
        CHECK (`salaryMin` IS NULL OR `salaryMin` >= 0),
    ADD CONSTRAINT `chk_jobs_salary_max_non_negative`
        CHECK (`salaryMax` IS NULL OR `salaryMax` >= 0),
    ADD CONSTRAINT `chk_jobs_salary_range`
        CHECK (`salaryMin` IS NULL OR `salaryMax` IS NULL OR `salaryMin` <= `salaryMax`);

-- AddForeignKey
ALTER TABLE `job_categories` ADD CONSTRAINT `job_categories_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `job_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_locations` ADD CONSTRAINT `job_locations_provinceId_fkey` FOREIGN KEY (`provinceId`) REFERENCES `job_locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_imports` ADD CONSTRAINT `job_imports_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `job_sources`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_imports` ADD CONSTRAINT `job_imports_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `admins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `job_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `job_locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `job_sources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_jobImportId_fkey` FOREIGN KEY (`jobImportId`) REFERENCES `job_imports`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_tag_assignments` ADD CONSTRAINT `job_tag_assignments_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_tag_assignments` ADD CONSTRAINT `job_tag_assignments_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `job_tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

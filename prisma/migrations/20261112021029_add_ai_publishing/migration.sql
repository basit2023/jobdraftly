-- AlterTable
ALTER TABLE `job_sources` ADD COLUMN `autoPublish` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `jobs` ADD COLUMN `imageUrl` TEXT NULL;

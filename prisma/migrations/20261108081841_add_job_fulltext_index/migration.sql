-- CreateIndex
CREATE FULLTEXT INDEX `ft_jobs_search` ON `jobs`(`title`, `description`, `skills`);

-- Imported sources do not always state a workplace arrangement. Preserve that uncertainty.
ALTER TABLE `jobs`
MODIFY `workplaceType` ENUM('NOT_SPECIFIED', 'ONSITE', 'HYBRID', 'REMOTE') NOT NULL;

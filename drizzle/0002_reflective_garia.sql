ALTER TABLE `checkins` ADD `client_mutation_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `checkins_author_id_client_mutation_id_unique` ON `checkins` (`author_id`,`client_mutation_id`);
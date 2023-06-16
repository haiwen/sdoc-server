CREATE TABLE `operation_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `doc_uuid` varchar(36) NOT NULL,
  `op_id` bigint(20) NOT NULL,
  `op_time` bigint(20) NOT NULL,
  `operations` longtext NOT NULL,
  `author` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `operation_log_op_time` (`op_time`),
  KEY `operation_log_doc_uuid` (`doc_uuid`),
  KEY `idx_operation_log_doc_uuid_op_id` (`doc_uuid`,`op_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `draft` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `username` varchar(255) NOT NULL,
  `origin_repo_id` varchar(36) NOT NULL,
  `origin_file_version` varchar(100) NOT NULL,
  `origin_file_uuid` char(36) NOT NULL,
  `draft_file_path` varchar(1024) NOT NULL,
  `publish_file_version` varchar(100) DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `draft_origin_file_uuid` (`origin_file_uuid`),
  KEY `draft_created_at` (`created_at`),
  KEY `draft_updated_at` (`updated_at`),
  KEY `draft_username` (`username`),
  KEY `draft_origin_repo_id` (`origin_repo_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

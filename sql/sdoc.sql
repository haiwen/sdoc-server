CREATE TABLE IF NOT EXISTS `sdoc_operation_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `doc_uuid` varchar(36) NOT NULL,
  `op_id` bigint(20) NOT NULL,
  `op_time` bigint(20) NOT NULL,
  `operations` longtext NOT NULL,
  `author` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sdoc_operation_log_op_time` (`op_time`),
  KEY `sdoc_operation_log_doc_uuid` (`doc_uuid`),
  KEY `sdoc_idx_operation_log_doc_uuid_op_id` (`doc_uuid`,`op_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `sdoc_review_apply_registration` (
  `apply_attempt_id` varchar(36) NOT NULL,
  `doc_uuid` varchar(36) NOT NULL,
  `apply_payload_digest` varchar(64) NOT NULL,
  `status` varchar(32) NOT NULL,
  `result` longtext NOT NULL,
  `created_at` bigint(20) NOT NULL,
  `updated_at` bigint(20) NOT NULL,
  PRIMARY KEY (`apply_attempt_id`),
  KEY `sdoc_review_apply_registration_doc_uuid` (`doc_uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

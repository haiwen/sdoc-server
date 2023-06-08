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

CREATE TABLE `history_name` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `doc_uuid` varchar(36) NOT NULL,
  `obj_id` varchar(40) NOT NULL,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `history_name_doc_uuid` (`doc_uuid`),
  UNIQUE KEY `history_name_doc_uuid_obj_id` (`doc_uuid`, `obj_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

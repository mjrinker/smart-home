CREATE TABLE `aliases` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `model` enum('device','room','group','preset','color') NOT NULL,
  `model_id` int(10) unsigned NOT NULL,
  `alias` varchar(255) NOT NULL,
  `label` varchar(255) NOT NULL,
  `preferred` tinyint(1) DEFAULT 0,
  `active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_alias_model` (`alias`,`model`,`active`),
  KEY `model_idx` (`model`),
  KEY `model_id_idx` (`model_id`),
  KEY `preferred_idx` (`preferred`)
) ENGINE=InnoDB AUTO_INCREMENT=53 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;


CREATE TABLE `colors` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `label` varchar(255) NOT NULL,
  `value` varchar(9) NOT NULL,
  `display_value` varchar(9) NOT NULL,
  `active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_name` (`name`,`active`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;


CREATE TABLE `conditional_actions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `model` enum('device','room','group') NOT NULL,
  `model_id` int(10) unsigned NOT NULL,
  `preset_id` int(10) unsigned NOT NULL,
  `action` varchar(255) NOT NULL,
  `condition_type` enum('time') NOT NULL,
  `condition` varchar(255) DEFAULT NULL,
  `active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_model__model_id__action__condition` (`model`,`model_id`,`action`,`condition`,`active`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;


CREATE TABLE `db_updates` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `applied_on` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;


CREATE TABLE `devices` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `mfg_id` varchar(64) NOT NULL,
  `room_id` int(10) unsigned DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `label` varchar(255) NOT NULL,
  `platform` varchar(255) NOT NULL,
  `type` enum('bulb','socket','thermostat','fan','garage','switch','dimmer') NOT NULL,
  `mfg_model` varchar(255) DEFAULT NULL,
  `mfg_sub_model` varchar(255) DEFAULT NULL,
  `firmware_version` varchar(20) DEFAULT NULL,
  `hardware_version` varchar(20) DEFAULT NULL,
  `order` int(11) NOT NULL DEFAULT 2147483647,
  `active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_mfg_id` (`mfg_id`,`active`),
  UNIQUE KEY `UK_name` (`name`,`active`),
  KEY `room_id_idx` (`room_id`)
) ENGINE=InnoDB AUTO_INCREMENT=52 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;


CREATE TABLE `groups` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `label` varchar(255) NOT NULL,
  `order` int(11) NOT NULL DEFAULT 2147483647,
  `active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_name` (`name`,`active`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;


CREATE TABLE `groups_models` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `group_id` int(10) unsigned NOT NULL,
  `model` enum('device','room','group') NOT NULL,
  `model_id` int(10) unsigned NOT NULL,
  `active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_group_id__model__model_id` (`group_id`,`model`,`model_id`,`active`)
) ENGINE=InnoDB AUTO_INCREMENT=59 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;


CREATE TABLE `linked_devices` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `source_device_id` int(10) unsigned NOT NULL,
  `target_model` enum('device','room','group') NOT NULL,
  `target_model_id` int(10) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `label` varchar(255) NOT NULL,
  `event` varchar(255) NOT NULL,
  `action` varchar(255) NOT NULL,
  `value` varchar(255) DEFAULT NULL,
  `datatype` enum('null','boolean','number','string') DEFAULT NULL,
  `active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_srcdevid_tgtmdl_tgtmdlid_evt_actn` (`source_device_id`,`target_model`,`target_model_id`,`event`,`action`,`active`),
  KEY `name_idx` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;


CREATE TABLE `preset_actions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `preset_id` int(10) unsigned NOT NULL,
  `action` varchar(255) NOT NULL,
  `value` varchar(255) DEFAULT NULL,
  `datatype` enum('null','boolean','number','string') DEFAULT NULL,
  `active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_preset_id__action` (`preset_id`,`action`,`active`)
) ENGINE=InnoDB AUTO_INCREMENT=98 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;


CREATE TABLE `presets` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `model` enum('device','room','group') NOT NULL,
  `model_id` int(10) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `label` varchar(255) NOT NULL,
  `active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_model__model_id__name` (`model`,`model_id`,`name`,`active`),
  KEY `name_idx` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=57 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;


CREATE TABLE `rooms` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `label` varchar(255) NOT NULL,
  `order` int(11) NOT NULL DEFAULT 2147483647,
  `active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_name` (`name`,`active`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;


CREATE TABLE `scene_actions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `scene_id` int(10) unsigned NOT NULL,
  `model` enum('device','room','group') NOT NULL,
  `model_id` int(10) unsigned NOT NULL,
  `action` varchar(255) NOT NULL,
  `value` varchar(255) DEFAULT NULL,
  `datatype` enum('null','boolean','number','string') DEFAULT NULL,
  `active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_scene_id__model__model_id__action` (`scene_id`,`model`,`model_id`,`action`,`active`)
) ENGINE=InnoDB AUTO_INCREMENT=58 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;


CREATE TABLE `scenes` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `label` varchar(255) NOT NULL,
  `order` int(11) NOT NULL DEFAULT 2147483647,
  `active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_name` (`name`,`active`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;


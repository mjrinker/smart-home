CREATE DATABASE IF NOT EXISTS `smart_home` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE `smart_home`;


CREATE TABLE IF NOT EXISTS `db_updates` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `applied_on` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY `PK_id`(`id`),
  UNIQUE KEY `UK_name`(`name`)
) ENGINE = InnoDB;


CREATE TABLE IF NOT EXISTS `rooms` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `label` VARCHAR(255) NOT NULL,
  `order` INT DEFAULT 2147483647 NOT NULL,
  `active` BOOLEAN DEFAULT TRUE,
  PRIMARY KEY `PK_id`(`id`),
  UNIQUE KEY `UK_name`(`name`, `active`)
) ENGINE = InnoDB;


CREATE TABLE IF NOT EXISTS `groups` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `label` VARCHAR(255) NOT NULL,
  `order` INT DEFAULT 2147483647 NOT NULL,
  `active` BOOLEAN DEFAULT TRUE,
  PRIMARY KEY `PK_id`(`id`),
  UNIQUE KEY `UK_name`(`name`, `active`)
) ENGINE = InnoDB;


CREATE TABLE IF NOT EXISTS `devices` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `mfg_id` VARCHAR(64) NOT NULL,
  `room_id` INT UNSIGNED,
  `name` VARCHAR(255) NOT NULL,
  `label` VARCHAR(255) NOT NULL,
  `platform` VARCHAR(255) NOT NULL,
  `type` ENUM('bulb', 'socket', 'thermostat', 'fan', 'garage') NOT NULL,
  `order` INT DEFAULT 2147483647 NOT NULL,
  `active` BOOLEAN DEFAULT TRUE,
  PRIMARY KEY `PK_id`(`id`),
  UNIQUE KEY `UK_mfg_id`(`mfg_id`, `active`),
  UNIQUE KEY `UK_name`(`name`, `active`),
  INDEX `room_id_idx` (`room_id` ASC)
) ENGINE = InnoDB;


CREATE TABLE IF NOT EXISTS `groups_models` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `group_id` INT UNSIGNED NOT NULL,
  `model` ENUM('device', 'room', 'group') NOT NULL,
  `model_id` INT UNSIGNED NOT NULL,
  `active` BOOLEAN DEFAULT TRUE,
  PRIMARY KEY `PK_id`(`id`),
  UNIQUE KEY `UK_group_id__model__model_id`(`group_id`, `model`, `model_id`, `active`)
) ENGINE = InnoDB;


CREATE TABLE IF NOT EXISTS `presets` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `model` ENUM('device', 'room', 'group') NOT NULL,
  `model_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `label` VARCHAR(255) NOT NULL,
  `active` BOOLEAN DEFAULT TRUE,
  PRIMARY KEY `PK_id`(`id`),
  UNIQUE KEY `UK_model__model_id__name`(`model`, `model_id`, `name`, `active`),
  INDEX `name_idx` (`name` ASC)
) ENGINE = InnoDB;


CREATE TABLE IF NOT EXISTS `preset_actions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `preset_id` INT UNSIGNED NOT NULL,
  `action` VARCHAR(255) NOT NULL,
  `value` VARCHAR(255),
  `datatype` ENUM('null', 'boolean', 'number', 'string'),
  `active` BOOLEAN DEFAULT TRUE,
  PRIMARY KEY `PK_id`(`id`),
  UNIQUE KEY `UK_preset_id__action`(`preset_id`, `action`, `active`)
) ENGINE = InnoDB;


CREATE TABLE IF NOT EXISTS `conditional_actions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `model` ENUM('device', 'room', 'group') NOT NULL,
  `model_id` INT UNSIGNED NOT NULL,
  `preset_id` INT UNSIGNED NOT NULL,
  `action` VARCHAR(255) NOT NULL,
  `condition_type` ENUM('time') NOT NULL,
  `condition` VARCHAR(255),
  `active` BOOLEAN DEFAULT TRUE,
  PRIMARY KEY `PK_id`(`id`),
  UNIQUE KEY `UK_model__model_id__action__condition`(`model`, `model_id`, `action`, `condition`, `active`)
) ENGINE = InnoDB;


CREATE TABLE IF NOT EXISTS `aliases` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `model` ENUM('device', 'room', 'group', 'preset', 'color') NOT NULL,
  `model_id` INT UNSIGNED NOT NULL,
  `alias` VARCHAR(255) NOT NULL,
  `label` VARCHAR(255) NOT NULL,
  `preferred` BOOLEAN DEFAULT FALSE,
  `active` BOOLEAN DEFAULT TRUE,
  PRIMARY KEY `PK_id`(`id`),
  UNIQUE KEY `UK_alias_model`(`alias`, `model`, `active`),
  INDEX `model_idx` (`model` ASC),
  INDEX `model_id_idx` (`model_id` ASC),
  INDEX `preferred_idx` (`preferred` DESC)
) ENGINE = InnoDB;


CREATE TABLE IF NOT EXISTS `scenes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `label` VARCHAR(255) NOT NULL,
  `order` INT DEFAULT 2147483647 NOT NULL,
  `active` BOOLEAN DEFAULT TRUE,
  PRIMARY KEY `PK_id`(`id`),
  UNIQUE KEY `UK_name`(`name`, `active`)
) ENGINE = InnoDB;


CREATE TABLE IF NOT EXISTS `scene_actions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `scene_id` INT UNSIGNED NOT NULL,
  `model` ENUM('device', 'room', 'group') NOT NULL,
  `model_id` INT UNSIGNED NOT NULL,
  `action` VARCHAR(255) NOT NULL,
  `value` VARCHAR(255),
  `datatype` ENUM('null', 'boolean', 'number', 'string'),
  `active` BOOLEAN DEFAULT TRUE,
  PRIMARY KEY `PK_id`(`id`),
  UNIQUE KEY `UK_scene_id__model__model_id__action`(`scene_id`, `model`, `model_id`, `action`, `active`)
) ENGINE = InnoDB;


CREATE TABLE IF NOT EXISTS `colors` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `label` VARCHAR(255) NOT NULL,
  `value` VARCHAR(9) NOT NULL,
  `display_value` VARCHAR(9) NOT NULL,
  `active` BOOLEAN DEFAULT TRUE,
  PRIMARY KEY `PK_id`(`id`),
  UNIQUE KEY `UK_name`(`name`, `active`)
) ENGINE = InnoDB;


INSERT INTO `colors` (`name`, `label`, `value`, `display_value`) VALUES
('white', 'White', '#ffffff', '#ffffff'),
('softwhite', 'Soft White', '#fefaf3', '#fefaf3'),
('gray', 'Gray', '#808080', '#808080'),
('red', 'Red', '#ff0000', '#ff0000'),
('tomato', 'Tomato', '#ff6347', '#ff6347'),
('orange', 'Orange', '#ffa500', '#ffa500'),
('paleorange', 'Pale Orange', '#ffdfbf', '#ffdfbf'),
('yellow', 'Yellow', '#ffff00', '#ffff00'),
('paleyellow', 'Pale Yellow', '#ffffe0', '#ffffe0'),
('green', 'Green', '#008000', '#008000'),
('palegreen', 'Pale Green', '#98fb98', '#98fb98'),
('lime', 'Lime', '#00ff00', '#00ff00'),
('cyan', 'Cyan', '#00ffff', '#00ffff'),
('skyblue', 'Sky Blue', '#87ceeb', '#87ceeb'),
('paleblue', 'Pale Blue', '#afddee', '#afddee'),
('blue', 'Blue', '#0000ff', '#0000ff'),
('purple', 'Purple', '#8800ff', '#8800ff'),
('palepurple', 'Pale Purple', '#e6e6fa', '#e6e6fa'),
('magenta', 'Magenta', '#ff00ff', '#ff00ff'),
('pink', 'Pink', '#ffc0ee', '#ffc0ee'),
('hotpink', 'Hot Pink', '#ff69b4', '#ff69b4'),
('rose', 'ROSE', '#f00060', '#f00060');

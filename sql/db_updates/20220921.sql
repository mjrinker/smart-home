CREATE TABLE IF NOT EXISTS `linked_devices` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `source_device_id` INT UNSIGNED NOT NULL,
    `target_model` ENUM('device', 'room', 'group') NOT NULL,
    `target_model_id` INT UNSIGNED NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `label` VARCHAR(255) NOT NULL,
    `event` VARCHAR(255) NOT NULL,
    `action` VARCHAR(255) NOT NULL,
    `value` VARCHAR(255),
    `datatype` ENUM('null', 'boolean', 'number', 'string'),
    `active` BOOLEAN DEFAULT TRUE,
    PRIMARY KEY `PK_id`(`id`),
    UNIQUE KEY `UK_srcdevid_tgtmdl_tgtmdlid_evt_actn`(
        `source_device_id`,
        `target_model`,
        `target_model_id`,
        `event`,
        `action`,
        `active`
    ),
    INDEX `name_idx` (`name` ASC)
) ENGINE = InnoDB;

INSERT INTO `linked_devices` (`source_device_id`, `target_model`, `target_model_id`, `name`, `label`, `event`, `action`, `value`, `datatype`) VALUES
((SELECT `id` FROM `devices` WHERE `name` = 'office_light_switch'), 'group', (SELECT `id` FROM `groups` WHERE `name` = 'office'), 'office_light_switch_off__office_off', 'Office Light Switch OFF -> Office OFF', 'off', 'off', 'true', 'boolean'),
((SELECT `id` FROM `devices` WHERE `name` = 'office_light_switch'), 'group', (SELECT `id` FROM `groups` WHERE `name` = 'office'), 'office_light_switch_on__office_on', 'Office Light Switch ON -> Office ON', 'on', 'on_preserve', 'true', 'boolean'),
((SELECT `id` FROM `devices` WHERE `name` = 'office_light_switch'), 'group', (SELECT `id` FROM `groups` WHERE `name` = 'office'), 'office_light_switch_dimmer__office_brightness', 'Office Light Switch DIMMER -> Office BRIGHTNESS', 'dimmer', 'brightness', 'mirror', 'number'),
((SELECT `id` FROM `devices` WHERE `name` = 'office_1'), 'device', (SELECT `id` FROM `devices` WHERE `name` = 'office_light_switch'), 'office_off__office_light_switch_off', 'Office OFF -> Office Light Switch OFF', 'off', 'off', 'true', 'boolean'),
((SELECT `id` FROM `devices` WHERE `name` = 'office_1'), 'device', (SELECT `id` FROM `devices` WHERE `name` = 'office_light_switch'), 'office_on__office_light_switch_on', 'Office ON -> Office Light Switch ON', 'on', 'on_preserve', 'true', 'boolean'),
((SELECT `id` FROM `devices` WHERE `name` = 'office_1'), 'device', (SELECT `id` FROM `devices` WHERE `name` = 'office_light_switch'), 'office_brightness__office_light_switch_dimmer', 'Office BRIGHTNESS -> Office Light Switch DIMMER', 'brightness', 'dimmer', 'mirror', 'number');

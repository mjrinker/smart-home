INSERT INTO `aliases` (`model`, `model_id`, `alias`, `label`)
VALUES ('room', (SELECT `id` FROM `rooms` WHERE `name` = 'liams_room'), 'liams', 'Liam''s');

ALTER TABLE `devices`
    ADD `mfg_model` VARCHAR(255) NULL AFTER `type`;

ALTER TABLE `devices`
    ADD `mfg_sub_model` VARCHAR(255) NULL AFTER `mfg_model`;

UPDATE `devices` SET `mfg_model` = 'msl120' WHERE `platform` = 'meross' AND `type` = 'bulb';
UPDATE `devices` SET `mfg_sub_model` = 'msl120b' WHERE `platform` = 'meross' AND `type` = 'bulb' AND `name` <> 'balcony';
UPDATE `devices` SET `mfg_sub_model` = 'msl120d' WHERE `platform` = 'meross' AND `type` = 'bulb' AND `name` <> 'balcony';
UPDATE `devices` SET `platform` = 'meross_local' WHERE `platform` = 'meross';

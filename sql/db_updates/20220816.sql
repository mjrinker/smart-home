UPDATE `devices` SET `mfg_model` = 'sp25' WHERE `platform` = 'tuya' AND `type` = 'socket';

ALTER TABLE `devices`
    ADD `hardware_version` VARCHAR(20) NULL AFTER `mfg_sub_model`;

ALTER TABLE `devices`
    ADD `firmware_version` VARCHAR(20) NULL AFTER `mfg_sub_model`;

UPDATE `devices` SET `firmware_version` = '2.1.16'  WHERE `mfg_sub_model` = 'msl120b';
UPDATE `devices` SET `firmware_version` = '2.1.4'  WHERE `mfg_sub_model` = 'msl120d';
UPDATE `devices` SET `hardware_version` = '2.0.0'  WHERE `mfg_model` = 'msl120';
UPDATE `devices` SET `firmware_version` = '1.0.0'  WHERE `mfg_model` = 'sp25';
UPDATE `devices` SET `hardware_version` = '1.0.0'  WHERE `mfg_model` = 'sp25';

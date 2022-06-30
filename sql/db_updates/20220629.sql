INSERT INTO `aliases` (`model`, `model_id`, `alias`, `label`)
VALUES ('room', (SELECT `id` FROM `rooms` WHERE `name` = 'liams_room'), 'liams', 'Liam''s');

UPDATE conditional_actions
SET `condition` = 'sunrise->21:00'
WHERE `condition` IS NULL;

UPDATE conditional_actions
SET `condition` = NULL
WHERE preset_id IN (SELECT id FROM presets WHERE name = 'daytime');


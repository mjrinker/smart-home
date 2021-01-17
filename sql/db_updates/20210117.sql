UPDATE conditional_actions
SET `condition` = 'sunrise->21:00'
WHERE preset_id IN (SELECT id FROM presets WHERE name = 'daytime');

UPDATE conditional_actions
SET `condition` = null
WHERE `condition` IN ('21:00->sunrise', '22:00->sunrise');

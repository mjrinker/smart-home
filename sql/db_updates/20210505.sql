-- remove presets corresponding to missing groups/rooms
DELETE FROM scene_actions
WHERE model = 'group' AND model_id IN (8, 9, 12, 13, 14);

DELETE FROM preset_actions
WHERE preset_id IN (
    SELECT id FROM presets
    WHERE model = 'group' AND model_id IN (8, 9, 12, 13, 14)
);

DELETE FROM conditional_actions
WHERE preset_id IN (
    SELECT id FROM presets
    WHERE model = 'group' AND model_id IN (8, 9, 12, 13, 14)
) OR (model = 'group' AND model_id IN (8, 9, 12, 13, 14));

DELETE FROM presets
WHERE model = 'group' AND model_id IN (8, 9, 12, 13, 14);

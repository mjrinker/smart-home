INSERT INTO groups_models (group_id, model, model_id)
VALUES
    ((SELECT id FROM `groups` WHERE name = 'babys_room'), 'device', (SELECT id FROM `devices` WHERE name = 'babys_room_1')),
    ((SELECT id FROM `groups` WHERE name = 'babys_room'), 'device', (SELECT id FROM `devices` WHERE name = 'babys_room_2')),
    ((SELECT id FROM `groups` WHERE name = 'babys_room'), 'device', (SELECT id FROM `devices` WHERE name = 'babys_room_3'));

INSERT INTO presets (model, model_id, name, label)
VALUES
       ('group', (SELECT id FROM `groups` WHERE name = 'office'), 'daytime', 'Daytime'),
       ('group', (SELECT id FROM `groups` WHERE name = 'office'), 'evening', 'Evening'),
       ('group', (SELECT id FROM `groups` WHERE name = 'office'), 'bedtime', 'Bedtime');

INSERT INTO preset_actions (preset_id, action, value, datatype)
VALUES
    ((SELECT id FROM presets WHERE name = 'daytime' AND model = 'group' AND model_id = (SELECT id FROM `groups` WHERE name = 'office')), 'brightness', '75', 'number'),
    ((SELECT id FROM presets WHERE name = 'daytime' AND model = 'group' AND model_id = (SELECT id FROM `groups` WHERE name = 'office')), 'temperature', '39', 'number'),
    ((SELECT id FROM presets WHERE name = 'evening' AND model = 'group' AND model_id = (SELECT id FROM `groups` WHERE name = 'office')), 'brightness', '8', 'number'),
    ((SELECT id FROM presets WHERE name = 'evening' AND model = 'group' AND model_id = (SELECT id FROM `groups` WHERE name = 'office')), 'temperature', '39', 'number'),
    ((SELECT id FROM presets WHERE name = 'bedtime' AND model = 'group' AND model_id = (SELECT id FROM `groups` WHERE name = 'office')), 'off', '1', 'boolean');

INSERT INTO conditional_actions (model, model_id, preset_id, action, condition_type, `condition`)
VALUES
    ('group', (SELECT id FROM `groups` WHERE name = 'office'), (SELECT id FROM presets WHERE name = 'daytime' AND model = 'group' AND model_id = (SELECT id FROM `groups` WHERE name = 'office')), 'on', 'time', NULL),
    ('group', (SELECT id FROM `groups` WHERE name = 'office'), (SELECT id FROM presets WHERE name = 'evening' AND model = 'group' AND model_id = (SELECT id FROM `groups` WHERE name = 'office')), 'on', 'time', 'sunset-1h->sunrise');

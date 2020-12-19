-- Add bedroom lamp as a room
INSERT INTO rooms (name, label, `order`) VALUES ('bedroom_lamp', 'Bedroom Lamp', 750);

-- Add balcony light
INSERT INTO rooms (name, label, `order`) VALUES ('balcony', 'Balcony', 1100);
INSERT INTO devices (mfg_id, room_id, name, label, platform, type) VALUES ('2004175188477690810748e1e91a0530', (SELECT id FROM rooms WHERE name = 'balcony'), 'balcony', 'Balcony', 'meross', 'bulb');

INSERT INTO presets (model, model_id, name, label)
VALUES
       ('device', (SELECT id FROM devices WHERE name = 'balcony'), 'daytime', 'Daytime'),
       ('device', (SELECT id FROM devices WHERE name = 'balcony'), 'evening', 'Evening');

INSERT INTO preset_actions (preset_id, action, value, datatype)
VALUES
       ((SELECT id FROM presets WHERE model = 'device' AND model_id = (SELECT id FROM devices WHERE name = 'balcony') AND name = 'daytime'), 'brightness', 100, 'number'),
       ((SELECT id FROM presets WHERE model = 'device' AND model_id = (SELECT id FROM devices WHERE name = 'balcony') AND name = 'daytime'), 'temperature', 40, 'number'),
       ((SELECT id FROM presets WHERE model = 'device' AND model_id = (SELECT id FROM devices WHERE name = 'balcony') AND name = 'evening'), 'brightness', 12, 'number'),
       ((SELECT id FROM presets WHERE model = 'device' AND model_id = (SELECT id FROM devices WHERE name = 'balcony') AND name = 'evening'), 'temperature', 10, 'number');

INSERT INTO conditional_actions (model, model_id, preset_id, action, condition_type, `condition`)
VALUES
       ('room', (SELECT id FROM rooms WHERE name = 'balcony'), (SELECT id FROM presets WHERE model = 'device' AND model_id = (SELECT id FROM devices WHERE name = 'balcony') AND name = 'daytime'), 'on', 'time', NULL),
       ('room', (SELECT id FROM rooms WHERE name = 'balcony'), (SELECT id FROM presets WHERE model = 'device' AND model_id = (SELECT id FROM devices WHERE name = 'balcony') AND name = 'evening'), 'on', 'time', 'sunset-1h->sunrise');

INSERT INTO scene_actions (scene_id, model, model_id, action, value, datatype)
VALUES
((SELECT id FROM scenes WHERE name = 'daytime_all'), 'device', (SELECT id FROM devices WHERE name = 'balcony'), 'preset', 'daytime', 'string'),
((SELECT id FROM scenes WHERE name = 'evening_all'), 'device', (SELECT id FROM devices WHERE name = 'balcony'), 'preset', 'evening', 'string');

-- Change Matt's Office to Office and Ashlee's Office to Baby's Room
UPDATE devices SET name = 'office_1', label = 'Office 1' WHERE name = 'matts_office_1';
UPDATE devices SET name = 'office_2', label = 'Office 2' WHERE name = 'matts_office_2';
UPDATE devices SET name = 'office_3', label = 'Office 3' WHERE name = 'matts_office_3';
UPDATE devices SET name = 'babys_room_1', label = 'Baby''s Room 1' WHERE name = 'ashlees_office_1';
UPDATE devices SET name = 'babys_room_2', label = 'Baby''s Room 2' WHERE name = 'ashlees_office_2';
UPDATE devices SET name = 'babys_room_3', label = 'Baby''s Room 3' WHERE name = 'ashlees_office_3';

UPDATE rooms SET name = 'office', label = 'Office' WHERE name = 'matts_office';
UPDATE rooms SET name = 'babys_room', label = 'Baby''s Room' WHERE name = 'ashlees_office';

DELETE FROM groups_models WHERE (model = 'device' AND model_id IN (SELECT id FROM devices WHERE name LIKE 'babys_room_%'));
DELETE FROM groups_models WHERE group_id = (SELECT id FROM `groups` WHERE name = 'office') AND model = 'group' AND model_id = (SELECT id FROM `groups` WHERE name = 'babys_room');
UPDATE groups_models SET group_id = (SELECT id FROM `groups` WHERE name = 'office') WHERE group_id = (SELECT id FROM `groups` WHERE name = 'matts_office');
DELETE FROM groups_models WHERE group_id IN (SELECT id FROM `groups` WHERE name LIKE 'office_%');

DELETE FROM `groups` WHERE name LIKE 'office_%';
DELETE FROM `groups` WHERE name = 'matts_office';
UPDATE `groups` SET name = 'babys_room', label = 'Baby''s Room' WHERE name = 'ashlees_office';


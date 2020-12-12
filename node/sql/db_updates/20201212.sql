UPDATE conditional_actions
SET `condition` = 'sunset+2h->sunrise'
WHERE `condition` = 'sunset-1h->sunrise';


UPDATE presets
SET name = 'dim', label = 'Dim'
WHERE (model = 'room' AND model_id IN (SELECT id FROM rooms WHERE name LIKE '%dining%') AND
       name = 'evening')
   OR (model = 'group' AND
       model_id IN (SELECT id FROM `groups` WHERE name = 'kitchen_main') AND
       name = 'evening');


INSERT INTO presets (model, model_id, name, label)
VALUES
('room', (SELECT id FROM rooms WHERE name LIKE '%dining%'), 'evening', 'Evening'),
('group', (SELECT id FROM `groups` WHERE name = 'kitchen_main'), 'evening', 'Evening');


INSERT INTO preset_actions (preset_id, action, value, datatype)
VALUES
((SELECT id FROM presets WHERE model = 'room' AND model_id IN (SELECT id FROM rooms WHERE name LIKE '%dining%') AND name = 'evening'), 'brightness', '40', 'number'),
((SELECT id FROM presets WHERE model = 'room' AND model_id IN (SELECT id FROM rooms WHERE name LIKE '%dining%') AND name = 'evening'), 'temperature', '30', 'number'),
((SELECT id FROM presets WHERE model = 'group' AND model_id IN (SELECT id FROM `groups` WHERE name = 'kitchen_main') AND name = 'evening'), 'brightness', '45', 'number'),
((SELECT id FROM presets WHERE model = 'group' AND model_id IN (SELECT id FROM `groups` WHERE name = 'kitchen_main') AND name = 'evening'), 'temperature', '30', 'number');


INSERT INTO conditional_actions (model, model_id, preset_id, action, condition_type, `condition`)
VALUES
('room', (SELECT id FROM rooms WHERE name LIKE '%dining%'), (SELECT id FROM presets WHERE model = 'room' AND model_id IN (SELECT id FROM rooms WHERE name LIKE '%dining%') AND name = 'evening'), 'on', 'time', 'sunset+2h->22:00'),
('group', (SELECT id FROM `groups` WHERE name = 'kitchen_main'), (SELECT id FROM presets WHERE model = 'group' AND model_id IN (SELECT id FROM `groups` WHERE name = 'kitchen_main') AND name = 'evening'), 'on', 'time', 'sunset+2h->22:00'),
('room', (SELECT id FROM rooms WHERE name LIKE '%dining%'), (SELECT id FROM presets WHERE model = 'room' AND model_id IN (SELECT id FROM rooms WHERE name LIKE '%dining%') AND name = 'dim'), 'on', 'time', '22:00->sunrise'),
('group', (SELECT id FROM `groups` WHERE name = 'kitchen_main'), (SELECT id FROM presets WHERE model = 'group' AND model_id IN (SELECT id FROM `groups` WHERE name = 'kitchen_main') AND name = 'dim'), 'on', 'time', '22:00->sunrise');

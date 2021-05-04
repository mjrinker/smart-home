-- change "Baby's Room" to "Liam's Room"
UPDATE devices SET `name` = 'liams_room_1', label = 'Liam''s Room 1' WHERE `name` = 'babys_room_1';
UPDATE devices SET `name` = 'liams_room_2', label = 'Liam''s Room 2' WHERE `name` = 'babys_room_2';
UPDATE devices SET `name` = 'liams_room_3', label = 'Liam''s Room 3' WHERE `name` = 'babys_room_3';
UPDATE `groups` SET `name` = 'liams_room', label = 'Liam''s Room' WHERE `name` = 'babys_room';
UPDATE rooms SET `name` = 'liams_room', label = 'Liam''s Room' WHERE `name` = 'babys_room';

-- disable conditional actions
UPDATE conditional_actions SET `active` = 0 WHERE `condition` IS NOT NULL;

-- modify the bedtime scene
-- ------------------------
-- disable Liam's room in bedtime scene
UPDATE scene_actions SET `active` = 0 WHERE scene_id = (SELECT id FROM scenes WHERE `name` = 'bedtime') AND model = 'group' AND model_id = (SELECT id from `groups` WHERE `name` = 'liams_room') AND `value` = 'bedtime';
-- change kitchen to kitchen main in bedtime scene
UPDATE scene_actions SET model_id = (SELECT id from `groups` WHERE `name` = 'kitchen_main') WHERE scene_id = (SELECT id FROM scenes WHERE `name` = 'bedtime') AND model = 'group' AND model_id = (SELECT id from `groups` WHERE `name` = 'kitchen') AND `value` = 'bedtime';
-- add kitchen hanging movie preset to bedtime scene
INSERT INTO scene_actions (scene_id, model, model_id, `action`, `value`, datatype)
VALUES ((SELECT id FROM scenes WHERE `name` = 'bedtime'), 'group', (SELECT id from `groups` WHERE `name` = 'kitchen_hanging'), 'preset', 'movie', 'string');
-- change bedtime brightness and temperature values for bedroom lamp, vanity, and master bathroom
UPDATE preset_actions SET `value` = 3 WHERE preset_id = (SELECT id FROM presets WHERE `name` = 'bedtime' AND model = 'device' AND model_id = (SELECT id from `devices` WHERE `name` = 'bedroom_lamp')) AND `action` = 'brightness';
UPDATE preset_actions SET `value` = 15 WHERE preset_id = (SELECT id FROM presets WHERE `name` = 'bedtime' AND model = 'group' AND model_id = (SELECT id from `groups` WHERE `name` = 'master_vanity')) AND `action` = 'brightness';
UPDATE preset_actions SET `value` = 51 WHERE preset_id = (SELECT id FROM presets WHERE `name` = 'bedtime' AND model = 'group' AND model_id = (SELECT id from `groups` WHERE `name` = 'master_vanity')) AND `action` = 'temperature';
UPDATE preset_actions SET `value` = 10 WHERE preset_id = (SELECT id FROM presets WHERE `name` = 'bedtime' AND model = 'group' AND model_id = (SELECT id from `groups` WHERE `name` = 'master_bath')) AND `action` = 'brightness';
UPDATE preset_actions SET `value` = 56 WHERE preset_id = (SELECT id FROM presets WHERE `name` = 'bedtime' AND model = 'group' AND model_id = (SELECT id from `groups` WHERE `name` = 'master_bath')) AND `action` = 'temperature';

-- create a view to easily display preset details/info
CREATE OR REPLACE VIEW preset_details AS
SELECT * FROM
    (
        SELECT * FROM
            (
                SELECT p.id as preset_id,
                       d.label as name,
                       p.model as model,
                       p.label as preset_name,
                       IF(value = '1', 'true', 'false') AS `on`,
                       NULL as off,
                       NULL as brightness,
                       NULL as temperature,
                       NULL as color
                FROM presets p
                         JOIN preset_actions pa ON p.id = pa.preset_id
                         JOIN devices d ON p.model = 'device' AND p.model_id = d.id
                WHERE p.active = 1
                  AND pa.active = 1
                  AND d.active = 1
                  AND pa.action = 'on'

                UNION ALL

                SELECT p.id as preset_id,
                       d.label as name,
                       p.model as model,
                       p.label as preset_name,
                       NULL AS `on`,
                       IF(value = '1', 'true', 'false') AS off,
                       NULL as brightness,
                       NULL as temperature,
                       NULL as color
                FROM presets p
                         JOIN preset_actions pa ON p.id = pa.preset_id
                         JOIN devices d ON p.model = 'device' AND p.model_id = d.id
                WHERE p.active = 1
                  AND pa.active = 1
                  AND d.active = 1
                  AND pa.action = 'off'

                UNION ALL

                SELECT a.*, b.temperature, c.color FROM
                    (SELECT p.id as preset_id,
                            d.label as name,
                            p.model as model,
                            p.label as preset_name,
                            NULL AS `on`,
                            NULL as off,
                            pa.value as brightness
                     FROM presets p
                              JOIN preset_actions pa ON p.id = pa.preset_id
                              JOIN devices d ON p.model = 'device' AND p.model_id = d.id
                     WHERE p.active = 1
                       AND pa.active = 1
                       AND d.active = 1
                       AND pa.action = 'brightness') a
                        LEFT JOIN
                    (SELECT p.id as preset_id,
                            pa.value as temperature,
                            NULL as color
                     FROM presets p
                              JOIN preset_actions pa ON p.id = pa.preset_id
                              JOIN devices d ON p.model = 'device' AND p.model_id = d.id
                     WHERE p.active = 1
                       AND pa.active = 1
                       AND d.active = 1
                       AND pa.action = 'temperature') b
                    ON a.preset_id = b.preset_id
                        LEFT JOIN
                    (SELECT p.id as preset_id,
                            NULL as temperature,
                            pa.value as color
                     FROM presets p
                              JOIN preset_actions pa ON p.id = pa.preset_id
                              JOIN devices d ON p.model = 'device' AND p.model_id = d.id
                     WHERE p.active = 1
                       AND pa.active = 1
                       AND d.active = 1
                       AND pa.action = 'color') c
                    ON a.preset_id = c.preset_id
            ) d

        UNION ALL

        SELECT * FROM
            (
                SELECT p.id as preset_id,
                       g.label as name,
                       p.model as model,
                       p.label as preset_name,
                       IF(value = '1', 'true', 'false') AS `on`,
                       NULL AS off,
                       NULL as brightness,
                       NULL as temperature,
                       NULL as color
                FROM presets p
                         JOIN preset_actions pa ON p.id = pa.preset_id
                         JOIN `groups` g ON p.model = 'group' AND p.model_id = g.id
                WHERE p.active = 1
                  AND pa.active = 1
                  AND g.active = 1
                  AND pa.action = 'on'

                UNION ALL

                SELECT p.id as preset_id,
                       g.label as name,
                       p.model as model,
                       p.label as preset_name,
                       NULL AS `on`,
                       IF(value = '1', 'true', 'false') AS off,
                       NULL as brightness,
                       NULL as temperature,
                       NULL as color
                FROM presets p
                         JOIN preset_actions pa ON p.id = pa.preset_id
                         JOIN `groups` g ON p.model = 'group' AND p.model_id = g.id
                WHERE p.active = 1
                  AND pa.active = 1
                  AND g.active = 1
                  AND pa.action = 'off'

                UNION ALL

                SELECT a.*, b.temperature, c.color FROM
                    (SELECT p.id as preset_id,
                            g.label as name,
                            p.model as model,
                            p.label as preset_name,
                            NULL AS `on`,
                            NULL as off,
                            pa.value as brightness
                     FROM presets p
                              JOIN preset_actions pa ON p.id = pa.preset_id
                              JOIN `groups` g ON p.model = 'group' AND p.model_id = g.id
                     WHERE p.active = 1
                       AND pa.active = 1
                       AND g.active = 1
                       AND pa.action = 'brightness') a
                        LEFT JOIN
                    (SELECT p.id as preset_id,
                            pa.value as temperature,
                            NULL as color
                     FROM presets p
                              JOIN preset_actions pa ON p.id = pa.preset_id
                              JOIN `groups` g ON p.model = 'group' AND p.model_id = g.id
                     WHERE p.active = 1
                       AND pa.active = 1
                       AND g.active = 1
                       AND pa.action = 'temperature') b
                    ON a.preset_id = b.preset_id
                        LEFT JOIN
                    (SELECT p.id as preset_id,
                            NULL as temperature,
                            pa.value as color
                     FROM presets p
                              JOIN preset_actions pa ON p.id = pa.preset_id
                              JOIN `groups` g ON p.model = 'group' AND p.model_id = g.id
                     WHERE p.active = 1
                       AND pa.active = 1
                       AND g.active = 1
                       AND pa.action = 'color') c
                    ON a.preset_id = c.preset_id
            ) g

        UNION ALL

        SELECT * FROM
            (
                SELECT p.id as preset_id,
                       r.label as name,
                       p.model as model,
                       p.label as preset_name,
                       IF(value = '1', 'true', 'false') AS `on`,
                       NULL AS off,
                       NULL as brightness,
                       NULL as temperature,
                       NULL as color
                FROM presets p
                         JOIN preset_actions pa ON p.id = pa.preset_id
                         JOIN rooms r ON p.model = 'room' AND p.model_id = r.id
                WHERE p.active = 1
                  AND pa.active = 1
                  AND r.active = 1
                  AND pa.action = 'on'

                UNION ALL

                SELECT p.id as preset_id,
                       r.label as name,
                       p.model as model,
                       p.label as preset_name,
                       NULL AS `on`,
                       IF(value = '1', 'true', 'false') AS off,
                       NULL as brightness,
                       NULL as temperature,
                       NULL as color
                FROM presets p
                         JOIN preset_actions pa ON p.id = pa.preset_id
                         JOIN rooms r ON p.model = 'room' AND p.model_id = r.id
                WHERE p.active = 1
                  AND pa.active = 1
                  AND r.active = 1
                  AND pa.action = 'off'

                UNION ALL

                SELECT a.*, b.temperature, c.color FROM
                    (SELECT p.id as preset_id,
                            r.label as name,
                            p.model as model,
                            p.label as preset_name,
                            NULL AS `on`,
                            NULL as off,
                            pa.value as brightness
                     FROM presets p
                              JOIN preset_actions pa ON p.id = pa.preset_id
                              JOIN rooms r ON p.model = 'room' AND p.model_id = r.id
                     WHERE p.active = 1
                       AND pa.active = 1
                       AND r.active = 1
                       AND pa.action = 'brightness') a
                        LEFT JOIN
                    (SELECT p.id as preset_id,
                            pa.value as temperature,
                            NULL as color
                     FROM presets p
                              JOIN preset_actions pa ON p.id = pa.preset_id
                              JOIN rooms r ON p.model = 'room' AND p.model_id = r.id
                     WHERE p.active = 1
                       AND pa.active = 1
                       AND r.active = 1
                       AND pa.action = 'temperature') b
                    ON a.preset_id = b.preset_id
                        LEFT JOIN
                    (SELECT p.id as preset_id,
                            NULL as temperature,
                            pa.value as color
                     FROM presets p
                              JOIN preset_actions pa ON p.id = pa.preset_id
                              JOIN rooms r ON p.model = 'room' AND p.model_id = r.id
                     WHERE p.active = 1
                       AND pa.active = 1
                       AND r.active = 1
                       AND pa.action = 'color') c
                    ON a.preset_id = c.preset_id
            ) r
    ) dgr
ORDER BY preset_id;

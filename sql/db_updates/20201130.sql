DELETE FROM groups_models WHERE group_id = (SELECT id FROM `groups` WHERE name = 'office') AND model = 'group' AND model_id = (SELECT id FROM `groups` WHERE name = 'babys_room');

-- Add Christmas Tree as room
INSERT INTO rooms (name, label, `order`) VALUES ('christmas_tree', 'Christmas Tree', 33);
UPDATE devices SET room_id = (SELECT id from rooms WHERE name = 'living_room'), name = 'christmas_tree', label = 'Christmas Tree' WHERE name = 'candle_socket';
UPDATE devices SET room_id = (SELECT id from rooms WHERE name = 'living_room'), name = 'living_room_usb', label = 'Living Room USB' WHERE name = 'vanity_usb';
UPDATE `groups` SET name = 'living_room_socket', label = 'Living Room Socket' WHERE name = 'Candle';
DELETE FROM aliases WHERE alias = 'air_freshener';

-- Add TV as room
INSERT INTO rooms (name, label, `order`) VALUES ('tv', 'TV', 67);

-- Add Matt's USB Charger as room
INSERT INTO rooms (name, label) VALUES ('matts_usb_charger', 'Matt''s USB Charger');

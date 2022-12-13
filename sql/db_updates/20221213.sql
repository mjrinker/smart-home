UPDATE colors SET value = '#fefa83' WHERE name = 'softwhite';
UPDATE colors SET value = '#ff2208' WHERE name = 'tomato';
UPDATE colors SET value = '#ff6308' WHERE name = 'paleorange';
UPDATE colors SET value = '#ff4400' WHERE name = 'orange';
UPDATE colors SET value = '#ffb000' WHERE name = 'yellow';
UPDATE colors SET value = '#ffb910' WHERE name = 'paleyellow';
UPDATE colors SET display_value = '#33bb00', value = '#00ff00' WHERE name = 'green';
UPDATE colors SET value = '#60e01a' WHERE name = 'palegreen';
UPDATE colors SET display_value = '#00ff00', value = '#33bb00' WHERE name = 'lime';
UPDATE colors SET value = '#48ffff' WHERE name = 'skyblue';
UPDATE colors SET value = '#5fffff' WHERE name = 'paleblue';
UPDATE colors SET display_value = '#0077ff', value = '#0033ff' WHERE name = 'blue';
UPDATE colors SET display_value = '#8f00ff', value = '#4400ff' WHERE name = 'purple';
UPDATE colors SET value = '#6644dd' WHERE name = 'palepurple';
UPDATE colors SET value = '#ff69b4' WHERE name = 'pink';
UPDATE colors SET value = '#e3268c' WHERE name = 'hotpink';
UPDATE colors SET label = 'Rose' WHERE name = 'rose';
UPDATE colors SET value = '#ff2200' WHERE name = 'redorange';

DELETE FROM colors WHERE name = 'gray';

INSERT INTO colors (name, label, value, display_value) VALUES ('yellowgreen', 'Yellow Green', '#99ff00', '#99ff00');
INSERT INTO colors (name, label, value, display_value) VALUES ('seafoam', 'Seafoam', '#00ffaa', '#00ffaa');

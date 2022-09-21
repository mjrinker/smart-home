ALTER TABLE
    smart_home.devices
MODIFY
    COLUMN `type` enum(
        'bulb',
        'socket',
        'thermostat',
        'fan',
        'garage',
        'switch',
        'dimmer'
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci NOT NULL;

INSERT INTO
    smart_home.devices (
        mfg_id,
        room_id,
        name,
        label,
        platform,
        `type`,
        mfg_model,
        mfg_sub_model,
        firmware_version,
        hardware_version,
        `order`,
        active
    )
VALUES
    (
        'C013CD',
        5,
        'office_light_switch',
        'Office Light Switch',
        'tasmota',
        'dimmer',
        'Gosund_SW2',
        'Gosund_SW2',
        '12.0.2_GS1.2',
        '2',
        5000,
        1
    );
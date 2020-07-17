import dotenv
from flask import Flask, json, jsonify, request
import os
import shutil
from urllib import parse

from meross_iot.cloud.device import AbstractMerossDevice
from meross_iot.cloud.devices.door_openers import GenericGarageDoorOpener
from meross_iot.cloud.devices.hubs import GenericHub
from meross_iot.cloud.devices.humidifier import GenericHumidifier
from meross_iot.cloud.devices.light_bulbs import GenericBulb
from meross_iot.cloud.devices.power_plugs import GenericPlug
from meross_iot.cloud.devices.subdevices.thermostats import ValveSubDevice, ThermostatV3Mode, ThermostatMode
from meross_iot.cloud.devices.subdevices.sensors import SensorSubDevice
from meross_iot.manager import MerossManager
from meross_iot.meross_event import MerossEventType
from meross_iot.cloud.abilities import *
from meross_iot.cloud.devices.light_bulbs import MODE_RGB, MODE_LUMINANCE, MODE_TEMPERATURE

if not os.path.isfile('.env'):
    shutil.copyfile('.env.sample', '.env')

dotenv.load_dotenv()
EMAIL = os.getenv('MEROSS_EMAIL')
PASSWORD = os.getenv('MEROSS_PASSWORD')

manager = None

DEVICE_TYPES = (AbstractMerossDevice, GenericBulb, GenericPlug, ValveSubDevice, GenericGarageDoorOpener, GenericHub,
                GenericHumidifier, SensorSubDevice)
ON_OFF_DEVICE_TYPES = (GenericBulb, GenericPlug, ValveSubDevice)
LIGHT_CONTROL_DEVICE_TYPES = (GenericBulb, GenericHumidifier)

api = Flask(__name__)


def get_path(obj, path):
    if not isinstance(path, list):
        keys = path.split('.')
    else:
        keys = path
    value = obj.copy()
    for key in keys:
        try:
            value = value[key]
        except KeyError:
            return None
    return value


def hex_color_to_rgb(hex):
    return tuple(int(hex[i:i + 2], 16) for i in (0, 2, 4))


def dec_to_hex(dec):
    if isinstance(dec, str):
        return dec
    return hex(dec)[2:]


def is_valid_decimal(s):
    try:
        float(s)
    except ValueError:
        return False
    else:
        return True


def event_handler(eventobj):
    if eventobj.event_type == MerossEventType.DEVICE_ONLINE_STATUS:
        print('Device online status changed: %s went %s' % (eventobj.device.name, eventobj.status))
        pass

    elif eventobj.event_type == MerossEventType.DEVICE_SWITCH_STATUS:
        print('Switch state changed: Device %s (channel %d) went %s' % (eventobj.device.name, eventobj.channel_id,
                                                                        eventobj.switch_state))
    elif eventobj.event_type == MerossEventType.CLIENT_CONNECTION:
        print('MQTT connection state changed: client went %s' % eventobj.status)

        # TODO: Give example of reconnection?

    elif eventobj.event_type == MerossEventType.GARAGE_DOOR_STATUS:
        print('Garage door is now %s' % eventobj.door_state)

    elif eventobj.event_type == MerossEventType.THERMOSTAT_MODE_CHANGE:
        print('Thermostat %s has changed mode to %s' % (eventobj.device.name, eventobj.mode))

    elif eventobj.event_type == MerossEventType.THERMOSTAT_TEMPERATURE_CHANGE:
        print('Thermostat %s has revealed a temperature change: %s' % (eventobj.device.name, eventobj.temperature))

    elif eventobj.event_type == MerossEventType.SENSOR_TEMPERATURE_CHANGE:
        print('Sensor %s has revealed a temp/humidity change: %s %s' % (
            eventobj.device.name, eventobj.temperature, eventobj.humidity))

    elif eventobj.event_type == MerossEventType.SENSOR_TEMPERATURE_ALERT:
        print('Sensor %s has revealed a temperature alert: %s' % (eventobj.device.name, eventobj.alert))

    else:
        print('Unknown event!')
        for key, value in vars(eventobj).items():
            print('\t%s %s' % (key, value))


def initiate_manager(email, password):
    return MerossManager.from_email_and_password(meross_email=email, meross_password=password)


def get_device(device_uuid):
    if manager is None:
        return None
    else:
        return manager.get_device_by_uuid(device_uuid)


def ACTION_NOT_SUPPORTED_ERROR(name, action):
    return jsonify({
        'success': False,
        'status': 400,
        'error': 'ACTION_NOT_SUPPORTED',
        'message': f'Device {name} does not support action {action}'
    }), 400


def VALUE_REQUIRED_ERROR(name, action):
    jsonify({
        'success': False,
        'status': 400,
        'error': 'VALUE_REQUIRED',
        'message': f'A value must be set to set the {action} of device {name}'
    }), 400


def INVALID_VALUE_ERROR(name, action, value, expected_type):
    jsonify({
        'success': False,
        'status': 400,
        'error': 'INVALID_VALUE',
        'message': f'Invalid value for {action} of device {name}; Expected: <{expected_type}>, Got: {value}'
    }), 400


def DEVICE_NOT_FOUND_ERROR(uuid):
    return jsonify({
        'success': False,
        'status': 404,
        'error': 'DEVICE_NOT_FOUND',
        'message': f'Cannot find device {uuid}'
    }), 404


def ACTION_NOT_FOUND_ERROR(action):
    return jsonify({
        'success': False,
        'status': 404,
        'error': 'ACTION_NOT_FOUND',
        'message': f'Cannot find action {action}'
    }), 404


def SETTING_NOT_FOUND_ERROR(name, action, value):
    return jsonify({
        'success': False,
        'status': 404,
        'error': 'SETTING_NOT_FOUND',
        'message': f'Cannot find mode {value} for {action} of device {name}'
    }), 404


def DEVICE_OFFLINE_ERROR(uuid):
    return jsonify({
        'success': False,
        'status': 503,
        'error': 'DEVICE_OFFLINE',
        'message': f'Device {uuid} is offline'
    }), 503


@api.route('/device/<uuid>/is_on', methods=['GET'])
def is_on(uuid):
    device = get_device(uuid)
    if device is None:
        return jsonify({
            'success': False,
            'status': 404,
            'error': 'DEVICE_NOT_FOUND',
            'message': 'Cannot find device'
        }), 404
    return json.dumps({
        'success': True,
        'is_on': device.get_status()['onoff']
    })


@api.route('/device/<uuid>/skills', methods=['GET'])
def get_skills(uuid):
    device = get_device(uuid)
    if device is None:
        return jsonify({
            'success': False,
            'status': 404,
            'error': 'DEVICE_NOT_FOUND',
            'message': 'Cannot find device'
        }), 404
    return json.dumps({
        'success': True,
        'skills': {
            'all': ALL in device.get_abilities(),
            'ability': ABILITY in device.get_abilities(),
            'skill': ABILITY in device.get_abilities(),
            'report': REPORT in device.get_abilities(),
            'online': ONLINE in device.get_abilities(),
            'wifi_list': WIFI_LIST in device.get_abilities(),
            'debug': DEBUG in device.get_abilities(),
            'trace': TRACE in device.get_abilities(),
            'bind': BIND in device.get_abilities(),
            'unbind': UNBIND in device.get_abilities(),
            'toggle': TOGGLE in device.get_abilities(),
            'toggle_x': TOGGLEX in device.get_abilities(),
            'trigger': TRIGGER in device.get_abilities(),
            'trigger_x': TRIGGERX in device.get_abilities(),
            'electricity': ELECTRICITY in device.get_abilities(),
            'consumption_x': CONSUMPTIONX in device.get_abilities(),
            'hub_toggle_x': HUB_TOGGLEX in device.get_abilities(),
            'hub_online': HUB_ONLINE in device.get_abilities(),
            'hub_mts100_temperature': HUB_MTS100_TEMPERATURE in device.get_abilities(),
            'hub_mts100_mode': HUB_MTS100_MODE in device.get_abilities(),
            'hub_mts100_all': HUB_MTS100_ALL in device.get_abilities(),
            'hub_ms100_all': HUB_MS100_ALL in device.get_abilities(),
            'hub_ms100_temp_hum': HUB_MS100_TEMPHUM in device.get_abilities(),
            'hub_ms100_alert': HUB_MS100_ALERT in device.get_abilities(),
            'hub_exception': HUB_EXCEPTION in device.get_abilities(),
            'hub_battery': HUB_BATTERY in device.get_abilities(),
            'garage_door_state': GARAGE_DOOR_STATE in device.get_abilities(),
            'light': LIGHT in device.get_abilities(),
            'luminance': device.get_light_color()['luminance'] if isinstance(device, LIGHT_CONTROL_DEVICE_TYPES)
                                                                  and device.supports_mode(MODE_LUMINANCE)
            else False,
            'brightness': device.get_light_color()['luminance'] if isinstance(device, LIGHT_CONTROL_DEVICE_TYPES)
                                                                   and device.supports_mode(MODE_LUMINANCE)
            else False,
            'temperature': device.get_light_color()['temperature'] if isinstance(device, LIGHT_CONTROL_DEVICE_TYPES)
                                                                      and device.supports_mode(MODE_TEMPERATURE)
            else False,
            'color_temp': device.get_light_color()['temperature'] if isinstance(device, LIGHT_CONTROL_DEVICE_TYPES)
                                                                     and device.supports_mode(MODE_TEMPERATURE)
            else False,
            'color': dec_to_hex(device.get_light_color()['rgb']) if isinstance(device, LIGHT_CONTROL_DEVICE_TYPES)
                                                                    and device.supports_mode(MODE_RGB)
            else False,
            'spray': SPRAY in device.get_abilities()
        }
    })


@api.route('/device/<uuid>/<action>', methods=['POST'])
def perform_action(uuid, action):
    device = get_device(uuid)
    status = False
    params = parse.parse_qs(request.query_string.decode('utf-8'))
    value = get_path(params, 'value')
    if isinstance(value, list):
        value = value[0]
    if device is None:
        return DEVICE_NOT_FOUND_ERROR(uuid)
    if not device.online:
        return DEVICE_OFFLINE_ERROR(uuid)
    if not isinstance(device, DEVICE_TYPES):
        return DEVICE_NOT_FOUND_ERROR(uuid)
    if action == 'off':
        if isinstance(device, ON_OFF_DEVICE_TYPES):
            device.turn_off()
        else:
            return ACTION_NOT_SUPPORTED_ERROR(device.name, action)
    elif action == 'on':
        if isinstance(device, ON_OFF_DEVICE_TYPES):
            device.turn_on()
            status = True
        else:
            return ACTION_NOT_SUPPORTED_ERROR(device.name, action)
    elif action == 'toggle':
        if isinstance(device, ON_OFF_DEVICE_TYPES):
            if device.get_status()['onoff']:
                device.turn_off()
            else:
                device.turn_on()
                status = True
        else:
            return ACTION_NOT_SUPPORTED_ERROR(device.name, action)
    elif action == 'brightness' or action == 'luminance':
        if isinstance(device, LIGHT_CONTROL_DEVICE_TYPES) and device.supports_light_control() and device.supports_luminance():
            if value is not None:
                device.set_light_color(luminance=value)
                status = True
            else:
                return VALUE_REQUIRED_ERROR(device.name, action)
        else:
            return ACTION_NOT_SUPPORTED_ERROR(device.name, action)
    elif action == 'color':
        if isinstance(device, LIGHT_CONTROL_DEVICE_TYPES) and device.supports_light_control() and device.is_rgb():
            if value is not None:
                color = hex_color_to_rgb(value)
                device.set_light_color(rgb=color)
                status = True
            else:
                return VALUE_REQUIRED_ERROR(device.name, action)
        else:
            return ACTION_NOT_SUPPORTED_ERROR(device.name, action)
    elif action == 'temperature':
        if value is None:
            return VALUE_REQUIRED_ERROR(device.name, action)
        if isinstance(device, LIGHT_CONTROL_DEVICE_TYPES) and device.supports_light_control() and device.is_light_temperature():
            device.set_light_color(temperature=value)
            status = True
        elif isinstance(device, ValveSubDevice):
            if is_valid_decimal(value):
                temperature = float(value)
                device.set_target_temperature(temperature)
            else:
                return INVALID_VALUE_ERROR(device.name, action, value, 'float')
        else:
            return ACTION_NOT_SUPPORTED_ERROR(device.name, action)
    elif action == 'mode':
        if isinstance(device, ValveSubDevice):
            if value is not None:
                mode = None
                if value.isdigit():
                    mode = int(value)
                elif value.upper() in ThermostatV3Mode.__members__:
                    mode = ThermostatV3Mode[value.upper()]
                elif value.upper() in ThermostatMode.__members__:
                    mode = ThermostatMode[value.upper()]
                if mode is None:
                    return SETTING_NOT_FOUND_ERROR(device.name, action, value)
                else:
                    device.set_mode(mode=mode)
                    status = True
            else:
                return VALUE_REQUIRED_ERROR(device.name, action)
        else:
            return ACTION_NOT_SUPPORTED_ERROR(device.name, action)
    else:
        return ACTION_NOT_FOUND_ERROR(action)
    light_state = None
    if isinstance(device, LIGHT_CONTROL_DEVICE_TYPES) and device.supports_light_control():
        device.get_light_color()  # sometimes it gets the wrong color the first time
        light_state = device.get_light_color()  # so do it twice
        light_state['luminance'] = int(value) if action == 'brightness' or action == 'luminance' else light_state[
            'luminance']
        light_state['rgb'] = value if action == 'color' else dec_to_hex(light_state['rgb'])
        light_state['temperature'] = int(value) if action == 'temperature' else light_state['temperature']
    return json.dumps({
        'success': True,
        'device': {
            'nickname': device.name,
            'data': {
                'online': True,
                'state': device.get_status() or status,
                'light_state': light_state
            },
            'name': device.name,
            'icon': None,
            'id': uuid,
            'dev_type': 'bulb',
            'ha_type': 'bulb'
        }
    })


if __name__ == '__main__':
    manager = initiate_manager(EMAIL, PASSWORD)
    try:
        # Register event handlers for the manager...
        manager.register_event_handler(event_handler)

        # Starts the manager
        manager.start()
        api.run()
    except Exception as e:
        manager.stop(True)
        raise e

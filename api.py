import asyncio
from aiohttp import web
import dotenv
import os
import shutil
import signal

from meross_iot.http_api import MerossHttpClient
from meross_iot.manager import MerossManager
from meross_iot.controller.device import BaseDevice, HubDevice, GenericSubDevice
from meross_iot.controller.mixins.garage import GarageOpenerMixin
from meross_iot.controller.mixins.spray import SprayMixin
from meross_iot.controller.mixins.light import LightMixin
from meross_iot.controller.mixins.toggle import ToggleXMixin, ToggleMixin
from meross_iot.controller.subdevice import Mts100v3Valve, Ms100Sensor
from meross_iot.model.enums import OnlineStatus, ThermostatV3Mode

if not os.path.isfile('.env'):
    shutil.copyfile('.env.sample', '.env')

dotenv.load_dotenv()
ENVIRONMENT = os.getenv('ENVIRONMENT')
EMAIL = os.getenv('MEROSS_EMAIL')
PASSWORD = os.getenv('MEROSS_PASSWORD')

PORT = 5001 if ENVIRONMENT == 'stg' else 5000

DEVICE_TYPES = (BaseDevice, LightMixin, ToggleXMixin, ToggleMixin, GarageOpenerMixin, HubDevice,
                SprayMixin, GenericSubDevice, Ms100Sensor, Mts100v3Valve)
ON_OFF_DEVICE_TYPES = (LightMixin, ToggleXMixin, ToggleMixin, Mts100v3Valve)
LIGHT_CONTROL_DEVICE_TYPES = LightMixin

api = web.Application()

http_api_client = None
manager = None


def ACTION_NOT_SUPPORTED_ERROR(name, action):
    raise web.HTTPBadRequest(body={
        'success': False,
        'status': 400,
        'error': 'ACTION_NOT_SUPPORTED',
        'message': f'Device {name} does not support action {action}'
    }, content_type='application/json')


def VALUE_REQUIRED_ERROR(name, action):
    raise web.HTTPBadRequest(body={
        'success': False,
        'status': 400,
        'error': 'VALUE_REQUIRED',
        'message': f'A value must be set to set the {action} of device {name}'
    }, content_type='application/json')


def INVALID_VALUE_ERROR(name, action, value, expected_type):
    raise web.HTTPBadRequest(body={
        'success': False,
        'status': 400,
        'error': 'INVALID_VALUE',
        'message': f'Invalid value for {action} of device {name}; Expected: <{expected_type}>, Got: {value}'
    }, content_type='application/json')


def DEVICE_NOT_FOUND_ERROR(uuid):
    raise web.HTTPBadRequest(body={
        'success': False,
        'status': 404,
        'error': 'DEVICE_NOT_FOUND',
        'message': f'Cannot find device {uuid}'
    }, content_type='application/json')


def ACTION_NOT_FOUND_ERROR(action):
    raise web.HTTPBadRequest(body={
        'success': False,
        'status': 404,
        'error': 'ACTION_NOT_FOUND',
        'message': f'Cannot find action {action}'
    }, content_type='application/json')


def SETTING_NOT_FOUND_ERROR(name, action, value):
    raise web.HTTPBadRequest(body={
        'success': False,
        'status': 404,
        'error': 'SETTING_NOT_FOUND',
        'message': f'Cannot find mode {value} for {action} of device {name}'
    }, content_type='application/json')


def DEVICE_OFFLINE_ERROR(uuid):
    raise web.HTTPBadRequest(body={
        'success': False,
        'status': 503,
        'error': 'DEVICE_OFFLINE',
        'message': f'Device {uuid} is offline'
    }, content_type='application/json')


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


def hex_color_to_rgb(hexd):
    return tuple(int(hexd[i:i + 2], 16) for i in (0, 2, 4))


def dec_to_hex(dec):
    if isinstance(dec, str):
        return dec
    return hex((dec[0] << 16) + (dec[1] << 8) + dec[2])[2:]


def is_valid_decimal(s):
    try:
        float(s)
    except ValueError:
        return False
    else:
        return True


def shutdown_api(arg):
    print('Shutting down API server...')
    signal.raise_signal(signal.SIGINT)


def initiate_manager():
    global http_api_client
    if isinstance(http_api_client, MerossHttpClient):
        return MerossManager(http_client=http_api_client)


def logout(sig, frame):
    global manager
    global http_api_client
    print('Logging out of Meross...')
    if isinstance(manager, MerossManager) and isinstance(http_api_client, MerossHttpClient):
        manager.close()
        asyncio.ensure_future(http_api_client.async_logout()).add_done_callback(shutdown_api)


def get_device_by_uuid(uuid):
    if isinstance(manager, MerossManager):
        return manager.find_devices(device_uuids=[uuid])[0]


def _is_on(device):
    if isinstance(device, LIGHT_CONTROL_DEVICE_TYPES):
        return device.get_light_is_on()
    if isinstance(device, ON_OFF_DEVICE_TYPES):
        return device.is_on()
    if isinstance(device, DEVICE_TYPES):
        return device.online_status == OnlineStatus.ONLINE
    return False


async def quit_api(request):
    if ENVIRONMENT == 'dev':
        logout(signal.SIGQUIT, 0)
        return web.json_response({'success': True})


async def get_devices(request):
    devices = []
    if isinstance(manager, MerossManager):
        for device in manager.find_devices():
            devices.append({
                'data': {
                    'online': device.online_status == OnlineStatus.ONLINE,
                    'state': _is_on(device)
                },
                'name': device.name,
                'icon': None,
                'id': device.uuid,
                'dev_type': device.type,
                'ha_type': device.type
            })
    return web.json_response(devices)


async def get_device(request):
    uuid = request.match_info['uuid']
    device = get_device_by_uuid(uuid)
    if device is None:
        return DEVICE_NOT_FOUND_ERROR(uuid)
    return web.json_response({
        'data': {
            'online': device.online_status == OnlineStatus.ONLINE,
            'state': _is_on(device)
        },
        'name': device.name,
        'icon': None,
        'id': device.uuid,
        'dev_type': device.type,
        'ha_type': device.type
    })


async def is_on(request):
    uuid = request.match_info['uuid']
    device = get_device_by_uuid(uuid)
    if device is None:
        return web.json_response({
            'success': False,
            'status': 404,
            'error': 'DEVICE_NOT_FOUND',
            'message': 'Cannot find device'
        }), 404
    return web.json_response({
        'success': True,
        'is_on': _is_on(device)
    })


async def get_skills(request):
    uuid = request.match_info['uuid']
    device = get_device_by_uuid(uuid)
    if device is None:
        return web.json_response({
            'success': False,
            'status': 404,
            'error': 'DEVICE_NOT_FOUND',
            'message': 'Cannot find device'
        }), 404
    return web.json_response({
        'success': True,
        'skills': {
            'online': isinstance(device, DEVICE_TYPES),
            'offline': isinstance(device, DEVICE_TYPES),
            'system_all': isinstance(device, DEVICE_TYPES),
            'system_ability': isinstance(device, DEVICE_TYPES),
            'system_online': isinstance(device, DEVICE_TYPES),
            'system_report': isinstance(device, DEVICE_TYPES),
            'system_debug': isinstance(device, DEVICE_TYPES),
            'control_bind': isinstance(device, DEVICE_TYPES),
            'control_unbind': isinstance(device, DEVICE_TYPES),
            'control_trigger': isinstance(device, DEVICE_TYPES),
            'control_trigger_x': isinstance(device, DEVICE_TYPES),
            'config_wifi_list': isinstance(device, DEVICE_TYPES),
            'config_trace': isinstance(device, DEVICE_TYPES),
            'control_toggle': isinstance(device, DEVICE_TYPES),
            'control_toggle_x': isinstance(device, DEVICE_TYPES),
            'control_electricity': isinstance(device, DEVICE_TYPES),
            'control_consumption_x': isinstance(device, DEVICE_TYPES),
            'control_light': isinstance(device, DEVICE_TYPES),
            'garage_door_state': isinstance(device, DEVICE_TYPES),
            'control_spray': isinstance(device, DEVICE_TYPES),
            'system_digest_hub': isinstance(device, DEVICE_TYPES),
            'hub_exception': isinstance(device, DEVICE_TYPES),
            'hub_battery': isinstance(device, DEVICE_TYPES),
            'hub_toggle_x': isinstance(device, DEVICE_TYPES),
            'hub_online': isinstance(device, DEVICE_TYPES),
            'hub_sensor_all': isinstance(device, DEVICE_TYPES),
            'hub_sensor_temphum': isinstance(device, DEVICE_TYPES),
            'hub_sensor_alert': isinstance(device, DEVICE_TYPES),
            'hub_mts100_all': isinstance(device, DEVICE_TYPES),
            'hub_mts100_temperature': isinstance(device, DEVICE_TYPES),
            'hub_mts100_mode': isinstance(device, DEVICE_TYPES),
            'luminance': isinstance(device, LIGHT_CONTROL_DEVICE_TYPES) and device.get_supports_luminance(),
            'brightness': isinstance(device, LIGHT_CONTROL_DEVICE_TYPES) and device.get_supports_luminance(),
            'temperature': isinstance(device, LIGHT_CONTROL_DEVICE_TYPES) and device.get_supports_temperature(),
            'color_temp': isinstance(device, LIGHT_CONTROL_DEVICE_TYPES) and device.get_supports_temperature(),
            'rgb': isinstance(device, LIGHT_CONTROL_DEVICE_TYPES) and device.get_supports_rgb(),
            'color': isinstance(device, LIGHT_CONTROL_DEVICE_TYPES) and device.get_supports_rgb(),
            'spray': isinstance(device, SprayMixin),
            'mode': isinstance(device, Mts100v3Valve)
        }
    })


async def perform_action(request):
    uuid = request.match_info['uuid']
    action = request.match_info['action']
    device = get_device_by_uuid(uuid)
    status = False
    value = request.rel_url.query.get('value')
    if isinstance(value, list):
        value = value[0]
    if device is None:
        return DEVICE_NOT_FOUND_ERROR(uuid)
    device_name = device.name if isinstance(device, DEVICE_TYPES) else ''
    if not device.online_status == OnlineStatus.ONLINE:
        return DEVICE_OFFLINE_ERROR(uuid)
    if not isinstance(device, DEVICE_TYPES):
        return DEVICE_NOT_FOUND_ERROR(uuid)
    if action == 'off':
        if isinstance(device, ON_OFF_DEVICE_TYPES):
            await device.async_turn_off()
        else:
            return ACTION_NOT_SUPPORTED_ERROR(device_name, action)
    elif action == 'on':
        if isinstance(device, ON_OFF_DEVICE_TYPES):
            await device.async_turn_on()
            status = True
        else:
            return ACTION_NOT_SUPPORTED_ERROR(device_name, action)
    elif action == 'toggle':
        if isinstance(device, ON_OFF_DEVICE_TYPES):
            await device.async_toggle()
            status = _is_on(device)
        else:
            return ACTION_NOT_SUPPORTED_ERROR(device_name, action)
    elif action == 'brightness' or action == 'luminance':
        if isinstance(device, LIGHT_CONTROL_DEVICE_TYPES) and device.get_supports_luminance():
            if value is not None:
                await device.async_set_light_color(luminance=value)
                status = True
            else:
                return VALUE_REQUIRED_ERROR(device_name, action)
        else:
            return ACTION_NOT_SUPPORTED_ERROR(device_name, action)
    elif action == 'color':
        if isinstance(device, LIGHT_CONTROL_DEVICE_TYPES) and device.get_supports_rgb():
            if value is not None:
                color = hex_color_to_rgb(value)
                print('color', color)
                await device.async_set_light_color(rgb=color)
                status = True
            else:
                return VALUE_REQUIRED_ERROR(device_name, action)
        else:
            return ACTION_NOT_SUPPORTED_ERROR(device_name, action)
    elif action == 'temperature':
        if value is None:
            return VALUE_REQUIRED_ERROR(device_name, action)
        if isinstance(device, LIGHT_CONTROL_DEVICE_TYPES) and device.get_supports_temperature():
            await device.async_set_light_color(temperature=value)
            status = True
        elif isinstance(device, Mts100v3Valve):
            if is_valid_decimal(value):
                temperature = float(value)
                await device.async_set_target_temperature(temperature)
            else:
                return INVALID_VALUE_ERROR(device_name, action, value, 'float')
        else:
            return ACTION_NOT_SUPPORTED_ERROR(device_name, action)
    elif action == 'mode':
        if isinstance(device, Mts100v3Valve):
            if value is not None:
                mode = None
                if value.upper() in ThermostatV3Mode.__members__:
                    mode = ThermostatV3Mode(value.upper())
                if mode is None:
                    return SETTING_NOT_FOUND_ERROR(device_name, action, value)
                else:
                    await device.async_set_mode(mode)
                    status = True
            else:
                return VALUE_REQUIRED_ERROR(device_name, action)
        else:
            return ACTION_NOT_SUPPORTED_ERROR(device_name, action)
    else:
        return ACTION_NOT_FOUND_ERROR(action)
    light_state = None
    if isinstance(device, LIGHT_CONTROL_DEVICE_TYPES):
        light_state = {
            'brightness': int(value) if action == 'brightness' or action == 'luminance' else (device.get_luminance() if device.get_supports_luminance() else None),
            'color': value if action == 'color' else (dec_to_hex(device.get_rgb_color()) if device.get_supports_rgb() else None),
            'temperature': int(value) if action == 'temperature' else (device.get_color_temperature() if device.get_supports_temperature() else None)
        }
    return web.json_response({
        'success': True,
        'device': {
            'nickname': device_name,
            'data': {
                'online': device.online_status == OnlineStatus.ONLINE,
                'state': _is_on(device) or status,
                'light_state': light_state
            },
            'name': device_name,
            'icon': None,
            'id': uuid,
            'dev_type': device.type,
            'ha_type': device.type
        }
    })


async def main():
    global http_api_client
    global manager
    http_api_client = await MerossHttpClient.async_from_user_password(email=EMAIL, password=PASSWORD)
    manager = initiate_manager()
    await manager.async_init()
    await manager.async_device_discovery()
    for device in manager.find_devices():
        await device.async_update()

    api.add_routes([web.get('/quit', quit_api),
                    web.get('/devices', get_devices),
                    web.get('/device/{uuid}', get_device),
                    web.get('/device/{uuid}/is_on', is_on),
                    web.get('/device/{uuid}/skills', get_skills),
                    web.post('/device/{uuid}/{action}', perform_action)])

    yellow = '\033[93m'
    esc_end = '\033[0m'
    print(f'{yellow}(Press CTRL+\\ to logout of Meross and quit){esc_end}', end='\n\n')


if __name__ == '__main__':
    signal.signal(signal.SIGQUIT, logout)
    loop = asyncio.get_event_loop()
    loop.run_until_complete(main())
    web.run_app(api, host='127.0.0.1', port=PORT)
    loop.close()

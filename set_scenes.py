from datetime import datetime
import dotenv
import json
import os
import shutil
import subprocess
import threading
import time

from meross_iot.cloud.devices.door_openers import GenericGarageDoorOpener
from meross_iot.cloud.devices.hubs import GenericHub
from meross_iot.cloud.devices.humidifier import GenericHumidifier, SprayMode
from meross_iot.cloud.devices.light_bulbs import GenericBulb
from meross_iot.cloud.devices.power_plugs import GenericPlug
from meross_iot.cloud.devices.subdevices.thermostats import ValveSubDevice, ThermostatV3Mode
from meross_iot.cloud.devices.subdevices.sensors import SensorSubDevice
from meross_iot.manager import MerossManager
from meross_iot.meross_event import MerossEventType

if not os.path.isfile('.env'):
    shutil.copyfile('.env.sample', '.env')

dotenv.load_dotenv()
EMAIL = os.getenv('MEROSS_EMAIL')
PASSWORD = os.getenv('MEROSS_PASSWORD')


def convert_time(millis):
    millis_left = str(int(millis % 1000)).zfill(3)
    seconds = str(int((millis / 1000) % 60)).zfill(2)
    minutes = str(int((millis / (1000 * 60)) % 60)).zfill(2)
    hours = str(int((millis / (1000 * 60 * 60)) % 24)).zfill(2)
    return f'{hours}:{minutes}:{seconds}.{millis_left}'


def event_handler(eventobj):
    if eventobj.event_type == MerossEventType.DEVICE_ONLINE_STATUS:
        # print('Device online status changed: %s went %s' % (eventobj.device.name, eventobj.status))
        print('', end='')
        pass

    elif eventobj.event_type == MerossEventType.DEVICE_SWITCH_STATUS:
        # print('Switch state changed: Device %s (channel %d) went %s' % (eventobj.device.name, eventobj.channel_id,
        #                                                                 eventobj.switch_state))
        print('', end='')
    elif eventobj.event_type == MerossEventType.CLIENT_CONNECTION:
        # print('MQTT connection state changed: client went %s' % eventobj.status)
        print('', end='')

        # TODO: Give example of reconnection?

    elif eventobj.event_type == MerossEventType.GARAGE_DOOR_STATUS:
        # print('Garage door is now %s' % eventobj.door_state)
        print('', end='')

    elif eventobj.event_type == MerossEventType.THERMOSTAT_MODE_CHANGE:
        # print('Thermostat %s has changed mode to %s' % (eventobj.device.name, eventobj.mode))
        print('', end='')

    elif eventobj.event_type == MerossEventType.THERMOSTAT_TEMPERATURE_CHANGE:
        # print('Thermostat %s has revealed a temperature change: %s' % (eventobj.device.name, eventobj.temperature))
        print('', end='')

    elif eventobj.event_type == MerossEventType.SENSOR_TEMPERATURE_CHANGE:
        # print('Sensor %s has revealed a temp/humidity change: %s %s' % (eventobj.device.name, eventobj.temperature, eventobj.humidity))
        print('', end='')

    elif eventobj.event_type == MerossEventType.SENSOR_TEMPERATURE_ALERT:
        # print('Sensor %s has revealed a temperature alert: %s' % (eventobj.device.name, eventobj.alert))
        print('', end='')

    else:
        # print('Unknown event!')
        # for key, value in vars(eventobj).items():
        #     print('\t%s %s' % (key, value))
        print('', end='')


def get_device(manager, device_type):
    device_kind_map = {
        'bulb': GenericBulb,
        'plug': GenericPlug,
        'door_opener': GenericGarageDoorOpener,
        'hub_device': GenericHub,
        'thermostat': ValveSubDevice,
        'sensor': SensorSubDevice,
        'humidifier': GenericHumidifier,
    }
    if device_type[0:2].lower() == 'ms':
        return manager.get_devices_by_type(device_type)
    else:
        try:
            return manager.get_devices_by_kind(device_kind_map[device_type])
        except KeyError:
            device_by_name = manager.get_device_by_name(device_type)
            if device_by_name is None:
                device_by_uuid = manager.get_device_by_uuid(device_type)
                if device_by_uuid is not None:
                    return [device_by_uuid]
            else:
                return [device_by_name]


def get_devices(manager, device_types=None):
    devices = []
    if isinstance(device_types, str):
        device_types = [device_types]
    if isinstance(device_types, list):
        if len(device_types) == 0:
            return manager.get_supported_devices()
        for device_type in device_types:
            devices.extend(get_device(manager, device_type))
    return devices


def get_dow(day_of_week):
    day_of_week_str = '{}'.format(day_of_week)
    days_of_week = {
        'mon': 0,
        'tue': 1,
        'wed': 2,
        'thu': 3,
        'fri': 4,
        'sat': 5,
        'sun': 6
    }
    return get_path(days_of_week, day_of_week_str.lower()[:3])


def get_path(obj, path, cast_as=None):
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
    if value is not None and cast_as is not None:
        return cast_as(value)
    return value


def initiate_manager(email, password):
    return MerossManager.from_email_and_password(meross_email=email, meross_password=password)


def key_exists(obj, key):
    try:
        value = obj[key]
        return True
    except KeyError:
        return False


def set_light_color(bulb, event, rgb, temperature, luminance):
    if rgb is not None:
        bulb.set_light_color(rgb=rgb)
    if temperature is not None:
        bulb.set_light_color(temperature=rgb)
    if luminance is not None:
        bulb.set_light_color(luminance=rgb)


def turn_device_off(device, event):
    device.turn_off()


def run_sequence(sequence, event):
    event.wait()
    for action in sequence:
        action['function'](*action['args'])


def set_scene(manager, scene, event):
    devices_names = [action['device_name'] for action in scene['actions']]
    scene_actions = {action['device_name']: action for action in scene['actions']}
    devices = {device.name: device for device in get_devices(manager, devices_names)}
    for device_name, device in devices.items():
        scene_action = scene_actions[device_name]
        device_status = device.get_status()
        if not (get_path(device_status, 'onoff') and get_path(scene_action, 'ignore_if_on')):
            sequence = []
            for action in scene_action['sequence']:
                args = (device, event)
                target_function = None

                if action['type'] == 'color':
                    rgb = get_path(action, 'rgb', tuple)
                    temperature = get_path(action, 'temperature')
                    luminance = get_path(action, 'luminance')
                    target_function = set_light_color
                    args = (device, event, rgb, temperature, luminance)
                if action['type'] == 'off':
                    target_function = turn_device_off
                sequence.append({
                    'function': target_function,
                    'args': args
                })
            thread = threading.Thread(name='blocking',
                                      target=run_sequence,
                                      args=(sequence, event))
            thread.start()


def queue_scene(manager, scene, wait_time, output_events, output_event):
    scene_name = get_path(scene, 'name')
    sequence_event = threading.Event()
    set_scene(manager, scene, sequence_event)
    # for ms in reversed(range(0, round(wait_time * 100) + 1)):
    #     time_left = convert_time(ms)
    #     if output_event.is_set():
    #         print(f'\rWaiting {time_left} for {scene_name}', end='')
    #     time.sleep(0.00099)
    time.sleep(wait_time)
    now = datetime.now()
    current_datetime = now.strftime('%a, %-d %b %Y - %H:%M:%S')
    print(f'\r{current_datetime}\t\tsetting scene: {scene_name}')
    sequence_event.set()
    output_events.pop(0)
    output_events[0].set()


if __name__ == '__main__':
    process = subprocess.Popen(['caffeinate', '-dismut', '84600'])
    with open('scenes.json', 'r') as fin:
        scenes = json.loads(fin.read())

    jobs = []
    scenes_by_name = {}

    for scene in scenes:
        scene_name = get_path(scene, 'name')
        if scene_name is not None:
            base_scene_name = scene_name
            scene_name_iterator = 1
            while key_exists(scenes_by_name, scene_name):
                scene_name_iterator += 1
                scene_name = f'{scene} {scene_name_iterator}'
            scene['name'] = scene_name
            scenes_by_name[scene_name] = scene
            schedules = get_path(scene, 'schedules')
            for schedule in schedules:
                days_of_week = get_path(schedule, 'days_of_week')
                schedule_time = get_path(schedule, 'time')
                if days_of_week is not None:
                    if not isinstance(days_of_week, list):
                        days_of_week = [days_of_week]
                    for day_of_week in days_of_week:
                        dow = get_dow(day_of_week)
                        if dow is not None:
                            jobs.append({
                                'scene': scene_name,
                                'day_of_week': day_of_week,
                                'dow': dow,
                                'time': schedule_time if schedule_time is not None else '0:00:00'
                            })

    with open('scenes.json', 'w') as fout:
        fout.write(json.dumps(scenes, indent=2))

    jobs.sort(key=lambda x: (x['dow'], x['time']))

    manager = initiate_manager(EMAIL, PASSWORD)
    try:
        manager.register_event_handler(event_handler)
        manager.start()
        threads = []
        output_events = []
        first_output_event_set = False
        TIME_FORMAT = '%H:%M:%S'
        while True:
            job = jobs[0]
            now = datetime.now()
            current_dow = now.weekday()
            current_time = now.strftime(TIME_FORMAT)
            if job['dow'] < current_dow or job['dow'] == current_dow and job['time'] < current_time:
                jobs.append(jobs.pop(0))
            elif job['dow'] == current_dow:
                time_delta = datetime.strptime(job['time'], TIME_FORMAT) - datetime.strptime(current_time, TIME_FORMAT)
                wait_time = time_delta.total_seconds()
                output_events.append(threading.Event())
                if not first_output_event_set:
                    output_events[0].set()
                    first_output_event_set = True
                threads.append(threading.Thread(name='non-blocking',
                                                target=queue_scene,
                                                args=(manager, scenes_by_name[job['scene']], wait_time, output_events, output_events[-1])))
                threads[-1].start()
                jobs.append(jobs.pop(0))
    except Exception as e:
        print()
        print('Stopping manager')
        manager.stop(True)
        process = subprocess.Popen(['killall', 'caffeinate'])
        raise e

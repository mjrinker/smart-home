import dotenv
import os
from random import randint
import shutil
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


def key_exists(obj, key):
    try:
        value = obj[key]
        return True
    except KeyError:
        return False


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
        print('Sensor %s has revealed a temp/humidity change: %s %s' % (eventobj.device.name, eventobj.temperature, eventobj.humidity))

    elif eventobj.event_type == MerossEventType.SENSOR_TEMPERATURE_ALERT:
        print('Sensor %s has revealed a temperature alert: %s' % (eventobj.device.name, eventobj.alert))

    else:
        print('Unknown event!')
        for key, value in vars(eventobj).items():
            print('\t%s %s' % (key, value))


def initiate_manager(email, password):
    return MerossManager.from_email_and_password(meross_email=email, meross_password=password)


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


def test_device(device, device_type):
    if device_type == 'bulb':
        if not device.online:
            print('The bulb %s seems to be offline. Cannot play with that...' % device.name)
            return
        print('Let\'s play with bulb %s' % device.name)
        if not device.supports_light_control():
            print('Too bad bulb %s does not support light control %s' % device.name)
        else:
            # Is this an rgb bulb?
            if device.is_rgb():
                # Let's make it red!
                device.set_light_color(rgb=(255, 0, 0))

            time.sleep(1)

            if device.is_light_temperature():
                device.set_light_color(temperature=10)

            time.sleep(1)

            # Let's dim its brightness
            if device.supports_luminance():
                random_luminance = randint(10, 100)
                device.set_light_color(luminance=random_luminance)

        device.turn_on()
        time.sleep(1)
        device.turn_off()
    elif device_type == 'plug':
        if not device.online:
            print('The plug %s seems to be offline. Cannot play with that...' % device.name)
            return

        print('Let\'s play with smart plug %s' % device.name)

        channels = len(device.get_channels())
        print('The plug %s supports %d channels.' % (device.name, channels))
        for i in range(0, channels):
            print('Turning on channel %d of %s' % (i, device.name))
            device.turn_on_channel(i)

            time.sleep(1)

            print('Turning off channel %d of %s' % (i, device.name))
            device.turn_off_channel(i)

        usb_channel = device.get_usb_channel_index()
        if usb_channel is not None:
            print('Awesome! This device also supports USB power.')
            device.enable_usb()
            time.sleep(1)
            device.disable_usb()

        if device.supports_electricity_reading():
            print('Awesome! This device also supports power consumption reading.')
            print('Current consumption is: %s' % str(device.get_electricity()))
    elif device_type == 'door_opener':
        if not device.online:
            print('The garage controller %s seems to be offline. Cannot play with that...' % device.name)
            return
        print('Opening door %s...' % device.name)
        device.open_door()
        print('Closing door %s...' % device.name)
        device.close_door()
    elif device_type == 'thermostat':
        if not device.online:
            print('The thermostat %s seems to be offline. Cannot play with that...' % device.name)
            return

        # Get the current preset mode
        print('Current mode: %s' % device.mode)
        print('Let\'s change the preset mode')
        device.set_mode(ThermostatV3Mode.COOL)

        # Note that the thermostat will not receive the command instantly, as it needs to be sent by the HUB via its
        # low power communication channel. So, we need to wait a bit until it gets received.
        print('Waiting a minute...')
        time.sleep(60)
        print('Current mode: %s' % device.mode)

        # Set the target temperature
        target_temp = randint(10, 30)
        print('Setting the target temperature to %f' % target_temp)
        device.set_target_temperature(target_temp=target_temp)

        # Note that the thermostat will not receive the command instantly, as it needs to be sent by the HUB via its
        # low power communication channel. So, we need to wait a bit until it gets received.
        time.sleep(60)
        print('Current mode: %s' % device.mode)
    elif device_type == 'sensor':
        print('Sensor "%s": Temperature: %s, Humidity: %s' % (device.name, device.temperature, device.humidity))
    elif device_type == 'humidifier':
        if not device.online:
            print('Smart humidifier %s seems to be offline. Cannot play with it at this time...' % device.name)
            return

        # Let's set its color to RED
        print('Setting the smart humidifier %s color to red' % device.name)
        device.configure_light(onoff=1, rgb=(255, 0, 0), luminance=100)
        print('Setting spray-mode to CONTINUOUS')
        device.set_spray_mode(spray_mode=SprayMode.CONTINUOUS)
        print('Waiting a bit before turning it off...')
        time.sleep(10)
        print('Setting spray-mode to OFF')
        device.set_spray_mode(spray_mode=SprayMode.OFF)
    else:
        print('no tests available for %s' % device_type)


def set_light_color(bulb, event, rgb, temperature, luminance):
    event.wait()
    if rgb is not None:
        bulb.set_light_color(rgb=rgb)
    if temperature is not None:
        bulb.set_light_color(temperature=rgb)
    if luminance is not None:
        bulb.set_light_color(luminance=rgb)


def set_scene(manager, scene):
    # Retrieve devices:
    bulbs = get_devices(manager, scene['bulb_names'])
    # Print some basic specs about the discovered devices
    event = threading.Event()
    for bulb in bulbs:
        if event.isSet():
            event.clear()
        rgb = get_path(scene, ['actions', bulb.name, 'rgb'])
        temperature = get_path(scene, ['actions', bulb.name, 'temperature'])
        luminance = get_path(scene, ['actions', bulb.name, 'luminance'])
        args = (bulb, event, rgb, temperature, luminance)
        thread = threading.Thread(name='blocking',
                                  target=set_light_color,
                                  args=args)
        thread.start()
    event.set()


def random_color_lights(bulb_names):
    # Retrieve devices:
    bulbs = get_devices(manager, bulb_names)
    # Print some basic specs about the discovered devices
    event = threading.Event()
    for bulb in bulbs:
        print(bulb)
        bulb.turn_on()
    for n in range(0, 255):
        random_r = randint(0, 255)
        random_g = randint(0, 255)
        random_b = randint(0, 255)
        for bulb in bulbs:
            if event.isSet():
                event.clear()
            thread = threading.Thread(name='blocking',
                                      target=set_light_color,
                                      args=(bulb, event, (random_r, random_g, random_b)))
            thread.start()
        event.set()
        time.sleep(1)


if __name__ == '__main__':
    # Initiates the Meross Cloud Manager. This is in charge of handling the communication with the remote endpoint
    manager = initiate_manager(EMAIL, PASSWORD)

    try:
        # Register event handlers for the manager...
        manager.register_event_handler(event_handler)

        # Starts the manager
        manager.start()

        bulb_names = [
            'Kitchen Hanging 1',
            'Kitchen Hanging 2',
            'Dining Chandelier 1',
            'Dining Chandelier 2',
            'Dining Chandelier 3',
            'Dining Chandelier 4',
            'Dining Chandelier 5',
            'Living Room 1',
            'Living Room 2'
            'Living Room 3',
            'Living Room 4',
            'Kitchen 1',
            'Kitchen 2',
            'Kitchen 3',
            'Ashlee\'s Office 1',
            'Ashlee\'s Office 2',
            'Ashlee\'s Office 3',
            'Matt Office 1',
            'Matt Office 2',
            'Matt Office 3',
            'Bedroom lamp',
            'Master Vanity 1',
            'Master Vanity 2',
            'Master Vanity 3',
            'Master Vanity 4',
            'Closet 1',
            'Closet 2',
            'Hall 1',
            'Hall 2',
            'Hall 3',
            'Hall 4',
            'Master Bedroom 1',
            'Master Bedroom 2',
            'Master Bedroom 3',
            'Master Bath 1',
            'Master Bath 2'
        ]

        # bulbs = get_devices(manager, 'bulb')
        # for bulb in bulbs:
        #     print(bulb.name, bulb.uuid)

        # for device in manager.get_supported_devices():
        #     print(device.name)

        # bulb = get_device(manager, 'Dining Chandelier 1')
        # bulb[0].set_light_color(rgb=(255, 0, 255))
        # bulb[0].turn_off()

        # scene = {
        #     'bulb_names': [
        #         'Dining Chandelier 1'
        #     ],
        #     'actions': {
        #         'Dining Chandelier 1': {
        #             'rgb': (64, 255, 128)
        #         }
        #     }
        # }
        #
        # event = threading.Event()
        # set_scene(manager, scene)

        # bulbs = get_device(manager, 'Matt Office 1')
        # bulb = bulbs[0]
        # print(bulb.get_status())

        # time.sleep(10)

        # elif eventobj.event_type == MerossEventType.DEVICE_BULB_SWITCH_STATE:
        # print('Bulb %s is now %s' % (eventobj.device.name, 'on'))

        # At this point, we are all done playing with the library, so we gracefully disconnect and clean resources.
        # Note! You MUST always call manager.stop() as it will invalidate the token used for this session
        print('We are done playing. Cleaning resources...')
        manager.stop(True)

        print('Bye bye!')
    except Exception as e:
        manager.stop(True)
        raise e

const { promisify } = require('util');
const MerossDevice = require('./device');

class Dimmer extends MerossDevice {
  constructor(options) {
    super(options);

    this.lightValues = {
      brightness: 100,
    };

    this.steps = {
      brightness: 24,
    };

    this.controlLight = promisify(this.device.controlLight).bind(this.device);
  }

  async turnOn() {
    const response = await super.turnOn();
    if (response?.success && response?.device?.data) {
      response.device.data.lightState = this.lightValues;
    }
    return response;
  }

  async turnOff() {
    const response = await super.turnOff();
    if (response?.success && response?.device?.data) {
      response.device.data.lightState = this.lightValues;
    }
    return response;
  }

  async getLightValues() {
    try {
      const response = await this.getSystemAllData();
      this.lightValues = {
        brightness: response?.all?.digest?.light?.luminance || null,
      };
      return this.lightValues;
    } catch (error) {
      return false;
    }
  }

  async supportsBrightness() {
    return this.supportsFeature('Appliance.Control.Light', ({ capacity }) => [4, 5, 6, 7].includes(capacity));
  }

  async getBrightness() {
    try {
      const response = await this.getSystemAllData();
      return response?.all?.digest?.light?.luminance || null;
    } catch (error) {
      return false;
    }
  }

  async setBrightness(value) {
    return this.setLightValues({ brightness: value }).catch(() => { });
  }

  async setLightValues(features = { brightness: null, color: null, temperature: null }) {
    let mode = 0;
    if (features.color) {
      mode += 1;
    }

    if (features.temperature) {
      mode += 2;
    }

    if (features.brightness) {
      mode += 4;
    }

    if (mode === 1) {
      const error = new Error('RGB mode not supported');
      error.name = 'ModeNotSupportedError';
      throw error;
    }

    if (mode === 2) {
      const error = new Error('TEMPERATURE mode not supported');
      error.name = 'ModeNotSupportedError';
      throw error;
    }

    if (mode === 3) {
      const error = new Error('RGB_TEMPERATURE mode not supported');
      error.name = 'ModeNotSupportedError';
      throw error;
    }

    if (mode === 5) {
      const error = new Error('RGB_LUMINANCE mode not supported');
      error.name = 'ModeNotSupportedError';
      throw error;
    }

    if (mode === 6) {
      const error = new Error('TEMPERATURE_LUMINANCE mode not supported');
      error.name = 'ModeNotSupportedError';
      throw error;
    }

    if (mode === 7) {
      const error = new Error('RGB_TEMPERATURE_LUMINANCE mode not supported');
      error.name = 'ModeNotSupportedError';
      throw error;
    }

    const lightValues = {
      capacity: mode, // 1 = RGB, 2 = TEMPERATURE, 3 = (not supported), 4 = LUMINANCE, 5 = RGB_LUMINANCE, 6 = TEMPERATURE_LUMINANCE
      channel: 0,
      luminance: features.brightness || this.lightValues.brightness,
    };

    try {
      const previousLightState = this.lightValues;
      this.lightValues.brightness = lightValues.luminance;
      this.controlLight(lightValues).catch(() => {
        this.lightValues = previousLightState;
      });
      return {
        success: true,
        device: {
          nickname: this.name,
          data: {
            online: true,
            state: true,
            lightState: {
              brightness: lightValues.luminance,
            },
          },
          name: this.name,
          icon: this.deviceDef.userDevIcon || this.deviceDef.devIconId,
          id: this.deviceDef.uuid,
          dev_type: this.deviceDef.deviceType,
          ha_type: this.deviceDef.deviceType,
        },
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        error: 'LIGHT_CONTROL_ERROR',
        message: `Cannot change light values: mfg_id ${this.deviceId}`,
      };
    }
  }
}

module.exports = Dimmer;

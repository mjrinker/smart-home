const { promisify } = require('util');
const MerossDevice = require('./device');

const retrieveColor = (response) => {
  const colorResponse = response?.all?.digest?.light?.rgb;
  return colorResponse ? ((colorResponse) + 0xFFFFFF + 1).toString(16).substring(1) : null;
};

class Bulb extends MerossDevice {
  constructor(options) {
    super(options);

    this.lightValues = {
      brightness: 100,
      colorTemp: 100,
      color: 'ffffff',
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

    if (mode === 3) {
      const error = new Error('RGB_TEMPERATURE mode not supported');
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
      temperature: features.temperature || this.lightValues.colorTemp,
      rgb: parseInt(features.color?.replaceAll(/[^\da-f]/gi, '') || 'ffffff', 16) || this.lightValues.color,
    };

    try {
      const previousLightState = this.lightValues;
      this.lightValues.brightness = lightValues.luminance;
      this.lightValues.colorTemp = lightValues.temperature;
      this.lightValues.color = lightValues.rgb;
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
              colorTemp: lightValues.temperature,
              color: lightValues.rgb,
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
        message: `Cannot change light values: mfgId ${this.deviceId}`,
      };
    }
  }

  async getLightValues() {
    try {
      const response = await this.getSystemAllData();
      this.lightValues = {
        brightness: response?.all?.digest?.light?.luminance || null,
        colorTemp: response?.all?.digest?.light?.temperature || null,
        color: retrieveColor(response),
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

  async supportsColor() {
    return this.supportsFeature('Appliance.Control.Light', ({ capacity }) => [1, 5, 7].includes(capacity)).catch(() => { });
  }

  async getColor() {
    try {
      const response = await this.getSystemAllData();
      return retrieveColor(response);
    } catch (error) {
      return false;
    }
  }

  async setColor(value) {
    return this.setLightValues({ color: value }).catch(() => { });
  }

  async supportsColorTemperature() {
    return this.supportsFeature('Appliance.Control.Light', ({ capacity }) => [2, 6, 7].includes(capacity)).catch(() => { });
  }

  async getColorTemperature() {
    try {
      const response = await this.getSystemAllData();
      return response?.all?.digest?.light?.temperature || null;
    } catch (error) {
      return false;
    }
  }

  async setColorTemperature(value) {
    return this.setLightValues({ temperature: value }).catch(() => { });
  }
}

module.exports = Bulb;

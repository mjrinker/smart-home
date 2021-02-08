const { promisify } = require('util');

class MerossDevice {
  constructor(options) {
    if (!options.deviceId) {
      throw new Error('Please pass the Meross Device ID');
    }
    this.deviceId = options.deviceId;

    if (!options.device) {
      throw new Error('Please pass the Meross Device');
    }
    this.device = options.device;

    if (!options.deviceDef) {
      throw new Error('Please pass the Meross Device Definition');
    }
    this.deviceDef = options.deviceDef;
    this.name = this.deviceDef.devName;

    this.online = false;
    this.state = false;
    this.override = true;
    this.lock = false;

    this.presets = { values: options.presets || [] };
    this.presets.iterator = this.presets.values[Symbol.iterator]();
    this.presets.next = () => {
      let next = this.presets.iterator.next();
      if (next.done) {
        this.presets.iterator = this.presets.values[Symbol.iterator]();
        next = this.presets.iterator.next();
      }
      return next.value;
    };
    this.presets.reset = () => {
      let next;
      do {
        next = this.presets.iterator.next();
      } while (!next.done);
    };

    this.controlToggleX = promisify(this.device.controlToggleX).bind(this.device);
    this.getSystemAllData = promisify(this.device.getSystemAllData).bind(this.device);
    this.getOnlineStatus = promisify(this.device.getOnlineStatus).bind(this.device);
    this.getSystemAbilities = promisify(this.device.getSystemAbilities).bind(this.device);
  }

  async turnOn() {
    try {
      const previousState = this.state;
      this.state = true;
      this.controlToggleX(0, true).catch(() => {
        this.state = previousState;
      });
      return {
        success: true,
        device: {
          nickname: this.name,
          data: {
            online: true,
            state: true,
            light_state: null,
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
        error: 'TOGGLE_ERROR',
        message: `Cannot turn device on: mfg_id ${this.deviceId}`,
        originalError: error,
      };
    }
  }

  async turnOff() {
    try {
      const previousState = this.state;
      this.state = false;
      this.controlToggleX(0, false).catch(() => {
        this.state = previousState;
      });
      return {
        success: true,
        device: {
          nickname: this.name,
          data: {
            online: true,
            state: false,
            light_state: null,
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
        error: 'TOGGLE_ERROR',
        message: `Cannot turn device on: mfg_id ${this.deviceId}`,
        originalError: error,
      };
    }
  }

  async toggle() {
    if (this.state) {
      return this.turnOff().catch(() => {});
    }
    return this.turnOn().catch(() => {});
  }

  async isOnline() {
    try {
      const response = await this.getOnlineStatus();
      this.online = !!response?.online?.status;
      return this.online;
    } catch (error) {
      return false;
    }
  }

  async isOn() {
    try {
      const response = await this.getSystemAllData();
      this.state = !!response?.all?.digest?.togglex[0]?.onoff;
      return this.state;
    } catch (error) {
      return false;
    }
  }

  async getState() {
    return {
      online: await this.isOnline(),
      state: await this.isOn(),
    };
  }

  async getSkills() {
    try {
      const response = await this.getSystemAbilities();
      return response.ability;
    } catch (error) {
      return {};
    }
  }

  async supportsFeature(feature, callback = null) {
    const skills = await this.getSkills();
    return callback === null ? !!skills[feature] : callback(skills[feature]);
  }

  async supportsLightControl() {
    return this.supportsFeature('Appliance.Control.Light').catch(() => {});
  }
}

module.exports = MerossDevice;

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

    this.online = false;
    this.state = false;

    this.controlToggleX = promisify(this.device.controlToggleX).bind(this.device);
    this.getSystemAllData = promisify(this.device.getSystemAllData).bind(this.device);
    this.getOnlineStatus = promisify(this.device.getOnlineStatus).bind(this.device);
    this.getSystemAbilities = promisify(this.device.getSystemAbilities).bind(this.device);
  }

  async turnOn() {
    try {
      this.controlToggleX(0, true);
      return {
        success: true,
        device: {
          nickname: this.deviceDef.devName,
          data: {
            online: true,
            state: true,
            light_state: null,
          },
          name: this.deviceDef.devName,
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
      };
    }
  }

  async turnOff() {
    try {
      this.controlToggleX(0, false);
      return {
        success: true,
        device: {
          nickname: this.deviceDef.devName,
          data: {
            online: true,
            state: false,
            light_state: null,
          },
          name: this.deviceDef.devName,
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
      };
    }
  }

  async toggle() {
    if (this.state) {
      return this.turnOff();
    }
    return this.turnOn();
  }

  async isOnline() {
    try {
      const response = await this.getOnlineStatus();
      return !!response?.online?.status;
    } catch (error) {
      return false;
    }
  }

  async isOn() {
    try {
      const response = await this.getSystemAllData();
      return !!response?.all?.digest?.togglex[0]?.onoff;
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
    return this.supportsFeature('Appliance.Control.Light');
  }
}

module.exports = MerossDevice;

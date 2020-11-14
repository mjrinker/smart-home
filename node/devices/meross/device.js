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
      throw new Error('Please pass the Meross Device Def');
    }
    this.deviceDef = options.deviceDef;

    this.controlToggleX = promisify(this.device.controlToggleX).bind(this.device);
    this.getSystemAllData = promisify(this.device.getSystemAllData).bind(this.device);
    this.getSystemAbilities = promisify(this.device.getSystemAbilities).bind(this.device);
    this.getOnlineStatus = promisify(this.device.getOnlineStatus).bind(this.device);
  }

  async turnOn() {
    try {
      await this.controlToggleX(0, true);
      return {
        success: true,
        device: {
          nickname: this.deviceDef.name,
          data: {
            online: true,
            state: true,
            light_state: {},
          },
          name: this.deviceDef.name,
          icon: null,
          id: this.deviceDef.mfg_id,
          dev_type: this.deviceDef.type,
          ha_type: this.deviceDef.type,
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
      await this.controlToggleX(0, false);
      return {
        success: true,
        device: {
          nickname: this.deviceDef.name,
          data: {
            online: true,
            state: false,
            light_state: {},
          },
          name: this.deviceDef.name,
          icon: null,
          id: this.deviceDef.mfg_id,
          dev_type: this.deviceDef.type,
          ha_type: this.deviceDef.type,
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
    if (await this.isOn()) {
      return this.turnOff();
    }
    return this.turnOn();
  }

  async isOn() {
    try {
      const response = await this.getSystemAllData();
      return !!response?.all?.digest?.togglex[0]?.onoff;
    } catch (error) {
      return false;
    }
  }

  async isOnline() {
    try {
      const response = await this.getOnlineStatus();
      return !!response?.online?.status;
    } catch (error) {
      return false;
    }
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

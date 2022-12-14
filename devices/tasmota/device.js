class TasmotaDevice {
  constructor({
    client,
    device,
    presets,
  }) {
    if (!client) {
      throw new Error('Please pass the Tasmota Device Client');
    }
    this.client = client;

    if (!device) {
      throw new Error('Please pass the Tasmota Device');
    }
    this.device = device;
    this.name = this.device.label;

    this.online = true;
    this.state = true;
    this.override = true;
    this.lock = false;
    this.dimmer = 0;

    this.presets = { values: presets || [] };
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
  }

  async turnOn() {
    try {
      const previousState = this.state;
      this.state = true;
      this.client.togglePower(true).catch(() => {
        this.state = previousState;
      });
      return {
        success: true,
        device: {
          nickname: this.name,
          data: {
            online: true,
            state: true,
          },
          name: this.name,
          icon: this.device.icon,
          id: this.device.id,
        },
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        error: 'TOGGLE_ERROR',
        message: `Cannot turn device on: id ${this.device.id}`,
        originalError: error,
      };
    }
  }

  async turnOff() {
    try {
      const previousState = this.state;
      this.state = false;
      this.client.togglePower(false).catch(() => {
        this.state = previousState;
      });
      return {
        success: true,
        device: {
          nickname: this.name,
          data: {
            online: true,
            state: false,
          },
          name: this.name,
          icon: this.device.icon,
          id: this.device.id,
        },
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        error: 'TOGGLE_ERROR',
        message: `Cannot turn device on: id ${this.device.id}`,
        originalError: error,
      };
    }
  }

  async toggle() {
    return this.client.togglePower().catch(() => { });
  }

  async isOnline() {
    try {
      this.online = await this.client.getOnlineStatus();
      return this.online;
    } catch (error) {
      return false;
    }
  }

  async isOn() {
    try {
      global.fn.pauseDeviceLinks(this.device.mfgId);
      this.state = (await this.client.getPowerState()).toUpperCase() !== 'OFF';
      global.fn.resumeDeviceLinks(this.device.mfgId);
      return this.state;
    } catch (error) {
      return false;
    }
  }

  async getState() {
    try {
      this.state = await this.isOn();
      // this.online = this.state;
      this.online = await this.isOnline();
    } catch (e) {
      this.state = false;
      this.online = false;
    }
    return {
      online: this.online,
      state: this.state,
    };
  }
}

module.exports = TasmotaDevice;

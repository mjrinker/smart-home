const TasmotaDevice = require('./device');

class Dimmer extends TasmotaDevice {
  async setDimmerLevel(level) {
    try {
      if (!this.state) {
        await this.turnOn();
      }

      const dimmerResponse = await this.client.setDimmerLevel(level);
      this.dimmer = dimmerResponse?.Dimmer || this.dimmer;
      return {
        success: true,
        device: {
          nickname: this.name,
          data: {
            online: true,
            state: true,
            dimmer: this.dimmer,
          },
          name: this.name,
          icon: this.device.icon,
          id: this.device.id,
        },
      };
    } catch (error) {
      return false;
    }
  }
}

module.exports = Dimmer;

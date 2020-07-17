/**
* Example script using cloudtuya to connect, get states an change them
*/

const fs = require('fs');
const CloudTuya = require('./cloudtuya');
const BaseDevice = require('./devices/baseDevice');

const name = 'cloudtuya';

console.log('booting %s', name);
// Load local files
let apiKeys = {};
let deviceNicknames = {};

try {
  apiKeys = require('./keys.json');
} catch (err) {
  console.error('keys.json is missing.');
}

try {
  deviceNicknames = require('./device_nicknames.json');
} catch (err) {
  console.error(err);
  console.warn('device_nicknames.json is missing. creating temporary');
  deviceNicknames = {};
}
/**
* Save Data Such a Devices to file
* @param {Object} data to save
* @param {String} [file="./devices.json"] to save to
*/
function saveDataToFile(data, file = './devices.json') {
  console.log(`Data ${JSON.stringify(data)}`);
  fs.writeFile(file, JSON.stringify(data), (err) => {
    if(err) {
      return console.error(err);
    }
    console.log(`The file ${file} was saved!`);
    return(file);
  });
}


async function main() {
  // Load from keys.json
  const api = new CloudTuya({
    userName: apiKeys.userName,
    password: apiKeys.password,
    bizType: apiKeys.bizType,
    countryCode: apiKeys.countryCode,
    region: apiKeys.region,
  });

  // Connect to cloud api and get access token.
  const tokens = await api.login();

  // Get all devices registered on the Tuya app
  // let devices = await api.find();
  // console.log('devices');
  // console.log(devices);

  // Setting new Device ID
  const deviceId = deviceNicknames['Candle Socket'];

  const mySocket = new BaseDevice({ api, deviceId });
  // mySocket.turnOn();
  mySocket.turnOff();
  // const isOn = await mySocket.isOn();
  // console.log(isOn);
}
main();

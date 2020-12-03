const MEROSS_URL = 'https://iot.meross.com';
const LOGOUT_URL = `${MEROSS_URL}/v1/Profile/logout`;

exports.logout = (merossAPI, callback) => {
  merossAPI.disconnectAll(true);
  merossAPI.authenticatedPost(LOGOUT_URL, {}, callback);
};

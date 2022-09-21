const {
  bgBrightCyan,
  bgBrightGreen,
  bgRed,
  bgYellow,
  brightBlack,
  brightWhite,
  white,
} = require('./ansicodes');

module.exports = () => {
  const fn = {};

  const {
    _,
    app,
    delay,
    geoLocation,
    getSunrise,
    getSunset,
    logger,
    tab,
    versions,
  } = global;

  fn.asyncArrayIterator = async (array, iterator, callback) => {
    const useIterator = iterator === 'forEach' ? 'map' : iterator;
    return Promise.all(array[useIterator]((value, key) => callback(value, key)));
  };

  fn.asyncMw = (func) => (req, res, next) => {
    Promise.resolve(func(req, res, next))
      .catch((error) => {
        let newError = error;
        if (!(error instanceof Error)) {
          const message = (error && typeof (error) === 'string') ? error : 'Server Error';
          newError = new Error(message);
        }

        logger.error(newError);
        if (next) {
          return next(newError);
        }

        return fn.sendResponse(req, res, 500, { error: newError });
      });
  };

  fn.castActionValue = (value, datatype) => {
    switch (datatype) {
      case 'null': {
        return null;
      }

      case 'boolean': {
        return !!parseInt(value, 10) || true;
      }

      case 'number': {
        return parseFloat(value, 10);
      }

      case 'string':
      // falls through
      default: {
        return `${value}`;
      }
    }
  };

  fn.filterMap = (collection, filterCallback, mapCallback) => {
    const array = [];
    collection?.forEach((element, index) => {
      let condition;
      if (_.isFunction(filterCallback)) {
        condition = filterCallback(element, index);
      } else if (_.isPlainObject(filterCallback)) {
        condition = _.isMatch(element, filterCallback);
      } else if (Array.isArray(filterCallback)) {
        condition = _.isMatch(element, { [filterCallback[0]]: filterCallback[1] });
      } else {
        condition = element.get(filterCallback);
      }

      if (_.isFunction(condition)) {
        condition = condition();
      }

      if (condition) {
        let newElement = null;
        if (_.isFunction(mapCallback)) {
          newElement = mapCallback(element, index);
        } else {
          newElement = element.get(mapCallback);
        }

        if (_.isFunction(newElement)) {
          newElement = newElement();
        }

        array.push(newElement);
      }
    });

    return array;
  };

  fn.filterObjectProperties = (obj, props) => (
    Object.fromEntries(props.map((prop) => [prop, obj?.[prop]]))
  );

  fn.getMilliseconds = (timeString) => {
    const timeUnits = timeString.replace(/([a-z]+)/gi, '$1<!--DELIMITER-->').split('<!--DELIMITER-->');
    return timeUnits.map((timeUnit) => {
      const amount = parseInt(timeUnit.replace(/\D/g, ''), 10);
      const unit = timeUnit.replace(/[^a-z]/gi, '');
      switch (unit) {
        case 'y': {
          return amount * 1000 * 60 * 60 * 24 * 365;
        }

        case 'M': {
          return amount * 1000 * 60 * 60 * 24 * 30;
        }

        case 'w': {
          return amount * 1000 * 60 * 60 * 24 * 7;
        }

        case 'd': {
          return amount * 1000 * 60 * 60 * 24;
        }

        case 'h': {
          return amount * 1000 * 60 * 60;
        }

        case 'm': {
          return amount * 1000 * 60;
        }

        case 's': {
          return amount * 1000;
        }

        case 'ms': {
          return amount;
        }

        default: {
          return '';
        }
      }
    }).filter((amount) => amount).reduce((a, b) => a + b, 0);
  };

  fn.isInTimeRange = (startTime, endTime, overrideDate = new Date()) => {
    const now = new Date(overrideDate);
    const today = new Date(now);
    const yesterday = new Date(today);
    const tomorrow = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    tomorrow.setDate(today.getDate() + 1);
    const yesterdayMidnight = new Date(yesterday);
    const todayMidnight = new Date(today);
    const tomorrowMidnight = new Date(tomorrow);
    yesterdayMidnight.setHours(0, 0, 0);
    todayMidnight.setHours(0, 0, 0);
    tomorrowMidnight.setHours(0, 0, 0);

    const startIsSunrise = startTime.match(/^sunrise/i);
    const startIsSunset = startTime.match(/^sunset/i);
    const endIsSunrise = endTime.match(/^sunrise/i);
    const endIsSunset = endTime.match(/^sunset/i);

    const sunriseYesterday = getSunrise(geoLocation.lat, geoLocation.lng, yesterdayMidnight);
    const sunriseToday = getSunrise(geoLocation.lat, geoLocation.lng, todayMidnight);
    const sunriseTomorrow = getSunrise(geoLocation.lat, geoLocation.lng, tomorrowMidnight);
    const sunsetYesterday = getSunset(geoLocation.lat, geoLocation.lng, yesterdayMidnight);
    const sunsetToday = getSunset(geoLocation.lat, geoLocation.lng, todayMidnight);
    const sunsetTomorrow = getSunset(geoLocation.lat, geoLocation.lng, tomorrowMidnight);

    let startTimeYesterday;
    let startTimeToday;
    let endTimeToday;
    let endTimeTomorrow;

    if (startIsSunrise) {
      startTimeYesterday = sunriseYesterday;
      startTimeToday = sunriseToday;
    } else if (startIsSunset) {
      startTimeYesterday = sunsetYesterday;
      startTimeToday = sunsetToday;
    } else {
      startTimeYesterday = new Date(`${yesterday.toDateString()} ${startTime}`);
      startTimeToday = new Date(`${today.toDateString()} ${startTime}`);
    }

    if (endIsSunrise) {
      endTimeToday = sunriseToday;
      endTimeTomorrow = sunriseTomorrow;
    } else if (endIsSunset) {
      endTimeToday = sunsetToday;
      endTimeTomorrow = sunsetTomorrow;
    } else {
      endTimeToday = new Date(`${today.toDateString()} ${endTime}`);
      endTimeTomorrow = new Date(`${tomorrow.toDateString()} ${endTime}`);
    }

    let startTimeDay = startTimeToday;
    let endTimeDay = endTimeToday;

    if (startTimeToday > endTimeToday) {
      if (now < startTimeToday && now < endTimeToday) {
        startTimeDay = startTimeYesterday;
      }

      if (now > endTimeToday) {
        endTimeDay = endTimeTomorrow;
      }
    }

    const start = startTime ? startTimeDay : yesterday;
    const end = endTime ? endTimeDay : tomorrow;
    return now >= start && now < end;
  };

  fn.parseTime = (timeString, suntimeDay = new Date()) => {
    const today = new Date();
    let date = new Date(today);
    if (timeString.match(/^sunrise/i)) {
      date = getSunrise(geoLocation.lat, geoLocation.lng, suntimeDay);
      const offset = timeString.replace(/sunrise/i, '');
      if (offset !== '') {
        const operator = offset.match(/^[-+]/)[0];
        const amount = offset.match(/(\d+[yMwdhms])/)[0];
        const offsetMilliseconds = fn.getMilliseconds(amount);
        if (operator === '+') {
          date.setTime(date.getTime() + offsetMilliseconds);
        } else if (operator === '-') {
          date.setTime(date.getTime() - offsetMilliseconds);
        }
      }
    } else if (timeString.match(/^sunset/i)) {
      date = getSunset(geoLocation.lat, geoLocation.lng, suntimeDay);
      const offset = timeString.replace(/sunset/i, '');
      if (offset !== '') {
        const operator = offset.match(/^[-+]/)[0];
        const amount = offset.match(/(\d+[yMwdhms])/)[0];
        const offsetMilliseconds = fn.getMilliseconds(amount);
        if (operator === '+') {
          date.setTime(date.getTime() + offsetMilliseconds);
        } else if (operator === '-') {
          date.setTime(date.getTime() - offsetMilliseconds);
        }
      }
    } else {
      const timeUnits = timeString.match(/(\d{2}):(\d{2})(:\d{2})?/);
      if (timeUnits) {
        const hours = parseInt(timeUnits[1] || '0', 10);
        const minutes = parseInt(timeUnits[2] || '0', 10);
        const seconds = parseInt(timeUnits[3] || '0', 10);
        date.setHours(hours, minutes, seconds);
      } else if (timeString === 'default') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday;
      } else {
        const error = new Error(`Invalid time ${timeString}`);
        error.name = 'INVALID_TIME';
        throw error;
      }
    }

    return date;
  };

  fn.pascalCase = (string) => (
    string.substring(0, 1).toUpperCase() + _.camelCase(string).substring(1)
  );

  fn.getResponseStatusAnsiColor = (status) => {
    if (status < 300) {
      return bgBrightGreen(brightBlack(` ${status} `));
    }
    if (status < 400) {
      return bgBrightCyan(brightBlack(` ${status} `));
    }
    if (status < 500) {
      return bgYellow(white(` ${status} `));
    }
    return bgRed(brightWhite(` ${status} `));
  };

  fn.sendResponse = (req, res, status = 200, body = null) => {
    logger.info(tab('RESPONSE', req.headers['X-Request-ID'], fn.getResponseStatusAnsiColor(status), body));
    if (_.isPlainObject(body)) {
      return res.status(status).json(body);
    }
    if (body) {
      return res.status(status).send(body);
    }
    return res.status(status).send();
  };

  fn.setRoutes = (params) => {
    params.routeList.forEach((route) => {
      let remainingVersions = [...versions];
      const path = (route.prefix || params.prefix) + route.path;
      const versionRoutesObj = {};
      route.versions.forEach((routeVersions, index) => {
        if (index < route.versions.length - 1) {
          remainingVersions = remainingVersions.filter((version) => (
            !routeVersions.versions.includes(version)
          ));
        } else {
          // eslint-disable-next-line no-param-reassign
          routeVersions.versions = remainingVersions;
        }

        routeVersions.versions.forEach((versionNumber) => {
          if (routeVersions.func) {
            versionRoutesObj[versionNumber] = routeVersions.func;
          } else {
            logger.warn('ROUTES:', routeVersions.func, 'not found');
          }
        });
      });

      if (route.auth) {
        // TODO do something
      } else {
        app[route.method](path, fn.asyncMw((req, res, next) => {
          let versionSupported = true;
          let version = req.header('X-ApiVersion') || versions[versions.length - 1];
          if (!versionRoutesObj[version]) {
            if (version.match(/\d+/) || version.match(/\d+\.\d+/)) {
              version = _.reverse([...versions]).find((versionNumber) => (
                versionNumber.substring(0, version.length) === version
              ));

              versionSupported = !!version;
            } else {
              versionSupported = false;
            }
          }

          if (!versionSupported) {
            return fn.sendResponse(req, res, 400, {
              success: false,
              status: 400,
              error: 'VERSION_NOT_SUPPORTED_ERROR',
              message: `Version not supported: ${version}`,
            });
          }

          return versionRoutesObj[version](req, res, next);
        }));
      }
    });
  };

  fn.slugify = (string) => _.snakeCase(`${string}`);

  fn.slugifyEntries = (obj) => (
    Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [fn.slugify(key), fn.slugify(value)]),
    )
  );

  fn.slugifyKeys = (obj) => (
    Object.fromEntries(Object.entries(obj).map(([key, value]) => [fn.slugify(key), value]))
  );

  fn.slugifyValues = (obj) => (
    Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, fn.slugify(value)]))
  );

  fn.waitUntil = async (condition, callback) => {
    let checkCondition;
    while (!checkCondition) {
      checkCondition = condition;
      if (typeof condition === 'function') {
        checkCondition = condition();
      }
      await delay(50);
    }

    return typeof callback === 'function' ? callback() : callback;
  };

  return fn;
};

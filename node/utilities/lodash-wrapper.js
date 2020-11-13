const _ = require('lodash');

const methods = {
  Array: ['chunk', 'compact', 'concat', 'difference', 'differenceBy', 'differenceWith', 'drop', 'dropRight', 'dropRightWhile', 'dropWhile', 'fill', 'findIndex', 'findLastIndex', 'first', 'flatten', 'flattenDeep', 'flattenDepth', 'fromPairs', 'head', 'indexOf', 'initial', 'intersection', 'intersectionBy', 'intersectionWith', 'join', 'last', 'lastIndexOf', 'nth', 'pull', 'pullAll', 'pullAllBy', 'pullAllWith', 'pullAt', 'remove', 'reverse', 'slice', 'sortedIndex', 'sortedIndexBy', 'sortedIndexOf', 'sortedLastIndex', 'sortedLastIndexBy', 'sortedLastIndexOf', 'sortedUniq', 'sortedUniqBy', 'tail', 'take', 'takeRight', 'takeRightWhile', 'takeWhile', 'union', 'unionBy', 'unionWith', 'uniq', 'uniqBy', 'uniqWith', 'unzip', 'unzipWith', 'without', 'xor', 'xorBy', 'xorWith', 'zip', 'zipObject', 'zipObjectDeep', 'zipWith'],
  Collection: ['countBy', 'each', 'eachRight', 'every', 'filter', 'find', 'findLast', 'flatMap', 'flatMapDeep', 'flatMapDepth', 'forEach', 'forEachRight', 'groupBy', 'includes', 'invokeMap', 'keyBy', 'map', 'orderBy', 'partition', 'reduce', 'reduceRight', 'reject', 'sample', 'sampleSize', 'shuffle', 'size', 'some', 'sortBy'],
  Date: ['now'],
  Function: ['after', 'ary', 'before', 'bind', 'bindKey', 'curry', 'curryRight', 'debounce', 'defer', 'delay', 'flip', 'memoize', 'negate', 'once', 'overArgs', 'partial', 'partialRight', 'rearg', 'rest', 'spread', 'throttle', 'unary', 'wrap'],
  Lang: ['castArray', 'clone', 'cloneDeep', 'cloneDeepWith', 'cloneWith', 'conformsTo', 'eq', 'gt', 'gte', 'isArguments', 'isArray', 'isArrayBuffer', 'isArrayLike', 'isArrayLikeObject', 'isBoolean', 'isBuffer', 'isDate', 'isElement', 'isEmpty', 'isEqual', 'isEqualWith', 'isError', 'isFinite', 'isFunction', 'isInteger', 'isLength', 'isMap', 'isMatch', 'isMatchWith', 'isNaN', 'isNative', 'isNil', 'isNull', 'isNumber', 'isObject', 'isObjectLike', 'isPlainObject', 'isRegExp', 'isSafeInteger', 'isSet', 'isString', 'isSymbol', 'isTypedArray', 'isUndefined', 'isWeakMap', 'isWeakSet', 'lt', 'lte', 'toArray', 'toFinite', 'toInteger', 'toLength', 'toNumber', 'toPlainObject', 'toSafeInteger', 'toString'],
  Math: ['add', 'ceil', 'divide', 'floor', 'max', 'maxBy', 'mean', 'meanBy', 'min', 'minBy', 'multiply', 'round', 'subtract', 'sum', 'sumBy'],
  Number: ['clamp', 'inRange', 'random'],
  Object: ['assign', 'assignIn', 'assignInWith', 'assignWith', 'at', 'create', 'defaults', 'defaultsDeep', 'entries', 'entriesIn', 'extend', 'extendWith', 'findKey', 'findLastKey', 'forIn', 'forInRight', 'forOwn', 'forOwnRight', 'functions', 'functionsIn', 'get', 'has', 'hasIn', 'invert', 'invertBy', 'invoke', 'keys', 'keysIn', 'mapKeys', 'mapValues', 'merge', 'mergeWith', 'omit', 'omitBy', 'pick', 'pickBy', 'result', 'set', 'setWith', 'toPairs', 'toPairsIn', 'transform', 'unset', 'update', 'updateWith', 'values', 'valuesIn'],
  String: ['camelCase', 'capitalize', 'deburr', 'endsWith', 'escape', 'escapeRegExp', 'kebabCase', 'lowerCase', 'lowerFirst', 'pad', 'padEnd', 'padStart', 'parseInt', 'repeat', 'replace', 'snakeCase', 'split', 'startCase', 'startsWith', 'template', 'toLower', 'toUpper', 'trim', 'trimEnd', 'trimStart', 'truncate', 'unescape', 'upperCase', 'upperFirst', 'words'],
};

/* eslint-disable no-extend-native */

const asyncFn = (obj, functions, methodName, ...args) => {
  const newArgs = _.map(args, (arg) => (arg.constructor.name === 'AsyncFunction' ? (...fnArgs) => arg(...fnArgs) : arg));
  const returnVal = functions[methodName](obj, ...newArgs);
  if (Array.isArray(returnVal)) {
    const numPromises = _.reduce(returnVal, (sum, n) => sum + (n ? n.constructor.name === 'Promise' : 0), 0);
    if (numPromises > 0) {
      return Promise.all(returnVal);
    }
  }

  return returnVal;
};

const staticAsyncFn = (functions, methodName, ...args) => {
  const newArgs = _.map(args, (arg) => (arg.constructor.name === 'AsyncFunction' ? (...fnArgs) => arg(...fnArgs) : arg));
  const returnVal = functions[methodName](...newArgs);
  if (Array.isArray(returnVal)) {
    const numPromises = _.reduce(returnVal, (sum, n) => sum + (n ? n.constructor.name === 'Promise' : 1), 0);
    if (numPromises > 0) {
      return Promise.all(returnVal);
    }
  }

  return returnVal;
};

methods.Array.forEach((methodName) => {
  Array.prototype[`_${methodName}`] = function (...args) {
    return asyncFn(this, _, methodName, ...args);
  };
});

methods.Collection.forEach((methodName) => {
  Array.prototype[`_${methodName}`] = function (...args) {
    return asyncFn(this, _, methodName, ...args);
  };

  Object.prototype[`_${methodName}`] = function (...args) {
    return asyncFn(this, _, methodName, ...args);
  };
});

methods.Function.forEach((methodName) => {
  if (methodName === 'bindKey') {
    Object.prototype[`_${methodName}`] = function (...args) {
      return asyncFn(this, _, methodName, ...args);
    };
  } else if (!['negate', 'wrap'].includes(methodName)) {
    if (['after', 'before'].includes(methodName)) {
      Function.prototype[`_${methodName}`] = function (n) {
        return _[`_${methodName}`](n, this);
      };
    } else {
      Function.prototype[`_${methodName}`] = function (...args) {
        return asyncFn(this, _, methodName, ...args);
      };
    }
  }
});

methods.Lang.forEach((methodName) => {
  const objectOnlyMethods = ['conformsTo', 'isMatch', 'isMatchWith'];
  if (objectOnlyMethods.includes(methodName)) {
    Object.prototype[`_${methodName}`] = function (...args) {
      return asyncFn(this, _, methodName, ...args);
    };
  } else {
    Boolean.prototype[`_${methodName}`] = function (...args) {
      return asyncFn(this.valueOf(), _, methodName, ...args);
    };

    Number.prototype[`_${methodName}`] = function (...args) {
      return asyncFn(this.valueOf(), _, methodName, ...args);
    };

    BigInt.prototype[`_${methodName}`] = function (...args) {
      return asyncFn(this.valueOf(), _, methodName, ...args);
    };

    String.prototype[`_${methodName}`] = function (...args) {
      return asyncFn(this.valueOf(), _, methodName, ...args);
    };

    Symbol.prototype[`_${methodName}`] = function (...args) {
      return asyncFn(this.valueOf(), _, methodName, ...args);
    };

    Object.prototype[`_${methodName}`] = function (...args) {
      return asyncFn(this, _, methodName, ...args);
    };

    Array.prototype[`_${methodName}`] = function (...args) {
      return asyncFn(this, _, methodName, ...args);
    };

    Map.prototype[`_${methodName}`] = function (...args) {
      return asyncFn(this, _, methodName, ...args);
    };

    WeakMap.prototype[`_${methodName}`] = function (...args) {
      return asyncFn(this, _, methodName, ...args);
    };

    Set.prototype[`_${methodName}`] = function (...args) {
      return asyncFn(this, _, methodName, ...args);
    };

    WeakSet.prototype[`_${methodName}`] = function (...args) {
      return asyncFn(this, _, methodName, ...args);
    };

    Date.prototype[`_${methodName}`] = function (...args) {
      return asyncFn(this, _, methodName, ...args);
    };

    Function.prototype[`_${methodName}`] = function (...args) {
      return asyncFn(this, _, methodName, ...args);
    };
  }
});

methods.Math.forEach((methodName) => {
  Math[`_${methodName}`] = function (...args) {
    return staticAsyncFn(_, methodName, ...args);
  };
});

methods.Number.forEach((methodName) => {
  if (methodName === 'random') {
    Number[`_${methodName}`] = function (...args) {
      return staticAsyncFn(_, methodName, ...args);
    };
  } else {
    Number.prototype[`_${methodName}`] = function (...args) {
      return asyncFn(this.valueOf(), _, methodName, ...args);
    };
  }
});

methods.Object.forEach((methodName) => {
  if (methodName !== 'create') {
    Object.prototype[`_${methodName}`] = function (...args) {
      return asyncFn(this, _, methodName, ...args);
    };
  }
});

methods.String.forEach((methodName) => {
  String.prototype[`_${methodName}`] = function (...args) {
    return asyncFn(this.valueOf(), _, methodName, ...args);
  };
});

const filterMap = (collection, filterCallback, mapCallback) => {
  const array = [];
  collection.forEach((element, index) => {
    let condition = null;
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

Array.prototype._filterMap = function (...args) {
  return asyncFn(this, { filterMap }, 'filterMap', ...args);
};

Object.prototype._filterMap = function (...args) {
  return asyncFn(this, { filterMap }, 'filterMap', ...args);
};

String.prototype._pascalCase = function () {
  const string = this.valueOf();
  return string.substring(0, 1).toUpperCase() + _.camelCase(string).substring(1);
};

/* eslint-enable no-extend-native */

module.exports = _;

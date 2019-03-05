/* eslint-disable no-not-accumulator-reassign/no-not-accumulator-reassign, no-var, vars-on-top, prefer-template, prefer-arrow-callback, func-names, prefer-destructuring, object-shorthand */
var util = require('util')
var prepareStackTrace = require('./prepare-stack-trace')

var getNativeClass =
  util.getNativeClass ||
  function(arg) {
    try {
      return (
        arg &&
        arg.isKindOfClass &&
        typeof arg.class === 'function' &&
        String(arg.class())
      )
    } catch (err) {
      return undefined
    }
  }

var isNativeObject =
  util.isNativeObject ||
  function(arg) {
    return !!getNativeClass(arg)
  }

function prepareArray(array, options) {
  return array.map(function(i) {
    return prepareValue(i, options)
  })
}

function prepareObject(object, options) {
  const deep = {}
  Object.keys(object).forEach(function(key) {
    deep[key] = prepareValue(object[key], options)
  })
  return deep
}

function getName(x) {
  return {
    type: 'String',
    primitive: 'String',
    value: String(x.name()),
  }
}

function getSelector(x) {
  return {
    type: 'String',
    primitive: 'String',
    value: String(x.selector()),
  }
}

function introspectMochaObject(value, options) {
  options = options || {}
  var mocha = value.class().mocha()
  var introspection = {
    properties: {
      type: 'Array',
      primitive: 'Array',
      value: util
        .toArray(
          mocha['properties' + (options.withAncestors ? 'WithAncestors' : '')]()
        )
        .map(getName),
    },
    classMethods: {
      type: 'Array',
      primitive: 'Array',
      value: util
        .toArray(
          mocha[
            'classMethods' + (options.withAncestors ? 'WithAncestors' : '')
          ]()
        )
        .map(getSelector),
    },
    instanceMethods: {
      type: 'Array',
      primitive: 'Array',
      value: util
        .toArray(
          mocha[
            'instanceMethods' + (options.withAncestors ? 'WithAncestors' : '')
          ]()
        )
        .map(getSelector),
    },
    protocols: {
      type: 'Array',
      primitive: 'Array',
      value: util
        .toArray(
          mocha['protocols' + (options.withAncestors ? 'WithAncestors' : '')]()
        )
        .map(getName),
    },
  }
  if (mocha.treeAsDictionary && options.withTree) {
    introspection.treeAsDictionary = {
      type: 'Object',
      primitive: 'Object',
      value: prepareObject(mocha.treeAsDictionary()),
    }
  }
  return introspection
}

function prepareValue(value, options) {
  var type
  var primitive
  if (util.isArray(value)) {
    type = Array.isArray(value) ? 'Array' : String(value.class())
    primitive = 'Array'
    value = prepareArray(util.toArray(value), options)
  } else if (util.isBoolean(value)) {
    type = typeof value === 'boolean' ? 'Boolean' : String(value.class())
    primitive = 'Boolean'
    value = Boolean(Number(value))
  } else if (util.isNullOrUndefined(value) || Number.isNaN(value)) {
    type = 'Empty'
    primitive = 'Empty'
    value = String(value)
  } else if (util.isNumber(value)) {
    type = typeof value === 'number' ? 'Number' : String(value.class())
    primitive = 'Number'
    value = Number(value)
  } else if (util.isString(value)) {
    type = typeof value === 'string' ? 'String' : String(value.class())
    primitive = 'String'
    value = String(value)
  } else if (util.isSymbol(value)) {
    type = 'Symbol'
    primitive = 'Symbol'
    value = util.inspect(value)
  } else if (util.isRegExp(value)) {
    type = 'RegExp'
    primitive = 'RegExp'
    value = util.inspect(value)
  } else if (util.isDate(value)) {
    type = 'Date'
    primitive = 'Date'
    value = util.inspect(value)
  } else if (util.isFunction(value)) {
    type = typeof value === 'function' ? 'Function' : String(value.class())
    primitive = 'Function'
    value = typeof value === 'function' ? '[Function]' : String(value.class())
  } else if (util.isBuffer(value)) {
    type = 'Buffer'
    primitive = 'Buffer'
    value = String(value)
  } else if (util.isError(value)) {
    type = 'Error'
    primitive = 'Error'
    value = {
      message: value.message,
      name: value.name,
      stack: prepareStackTrace(value.stack, options),
    }
  } else if (util.isObject(value)) {
    var nativeClass = getNativeClass(value)
    type = nativeClass ? nativeClass : 'Object'
    primitive = 'Object'
    value = prepareObject(util.toObject(value), options)
  } else if (isNativeObject(value)) {
    type = getNativeClass(value)
    // special case for NSException
    if (type === 'NSException') {
      primitive = 'Error'
      var stack = ''
      var userInfo = value.userInfo && value.userInfo() ? value.userInfo() : {}
      if (userInfo.stack) {
        stack = String(userInfo.stack)
      }
      value = {
        message: String(value.reason()),
        name: String(value.name()),
        stack: prepareStackTrace(stack, options),
        userInfo: prepareObject(util.toObject(userInfo), options),
      }
    } else if (value.class().mocha) {
      primitive = 'Mocha'
      value = (options || {}).skipMocha
        ? type
        : introspectMochaObject(value, options)
    } else {
      primitive = 'Unknown'
      value = type
    }
  } else {
    type = 'Unknown'
    primitive = 'Unknown'
    value = type
  }

  return {
    value,
    type,
    primitive,
  }
}

module.exports = prepareValue
module.exports.prepareObject = prepareObject
module.exports.prepareArray = prepareArray

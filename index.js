var prepareValue = require('./prepare-value')

module.exports.toArray = require('util').toArray
module.exports.prepareStackTrace = require('./prepare-stack-trace')
module.exports.prepareValue = prepareValue
module.exports.prepareObject = prepareValue.prepareObject
module.exports.prepareArray = prepareValue.prepareArray

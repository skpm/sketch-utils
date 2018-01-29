# Sketch Utils

_A collection of useful functions to deal with Sketch's CocoaScript bridge_

## Installation

```bash
npm install --save sketch-utils
```

## API

### `utils.toArray`

When an `NSArray` is bridged by CocoaScript, it is not exactly a JavaScript array, some methods are missing (like `map` for example). `utils.toArray` makes sure that you have a proper array.

```js
var utils = require('sketch-utils')

var array = utils.toArray(nsArray)
```

### `utils.prepareStackTrace`

When an error occurs, CocoaScript returns a stack trace that is not following the NodeJS syntax. `utils.prepareStackTrace` parses the stack trace and returns an array of callsites.

```js
var utils = require('sketch-utils')

var stackTrace = utils.prepareStackTrace(err.stack)
[
  {
    fn: string, // the name of the function in which the error occurred
    file: string, // the name of the file in which the error occurred
    filePath: string, // the path to the file
    line: number, // the line at which the error occurred
    column: number // the column at which the error occurred
  }
]
```

### `utils.prepareValue`

If you try to log an object, you probably won't get lucky. The CocoaScript bridge makes it really painful to get a meaningful introspection. `utils.prepareValue` takes any kind of object and return a standardized object that will be well bridged.

The object looks like this:

```js
{
  type: string, // the type of object. It will be the Obj-C class in case it's a native object
  primitive: string, // for normal object, it will be the same as type. For a native object, it will be a JS primitive (String, Array, Number, etc.) if the object can be assimilated as one; or `Mocha`,
  value: any, // the value (in case of an Object or an Array, each value will be a similar object)
}
```

```js
var utils = require('sketch-utils')

var value = utils.prepareValue(x, {
  skipMocha: false, // if false, the value of a native object will be an object {properties, classMethods, instanceMethods, protocols} otherwise, it will be the class name
  withAncestors: false, // if true, the {properties, classMethods, instanceMethods, protocols} object will contains the properties, methods and protocols of the ancestors as well
  withTree: false, // if true, a fifth key will be added to the introspection object: `treeAsDictionary`
})
```

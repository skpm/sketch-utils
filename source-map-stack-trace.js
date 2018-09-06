// taken for most part from https://github.com/evanw/node-source-map-support/blob/master/source-map-support.js

var SourceMapConsumer = require('source-map/lib/source-map-consumer')
  .SourceMapConsumer
var path = require('@skpm/path')
var fs = require('@skpm/fs')
var Buffer = require('@skpm/buffer')

// Regex for detecting source maps
const reSourceMap = /^data:application\/json[^,]+base64,/

function retrieveFile(filePath, caches) {
  // Trim the path to make sure there is no extra whitespace.
  filePath = filePath.trim() // eslint-disable-line
  if (filePath in caches.fileContents) {
    return caches.fileContents[filePath]
  }

  var contents = null
  try {
    contents = fs.readFileSync(filePath, 'utf8')
  } catch (err) {
    contents = ''
  }

  caches.fileContents[filePath] = contents

  return contents
}

// Support URLs relative to a directory, but be careful about a protocol prefix
// in case we are in the browser (i.e. directories may start with "http://")
var webpackSource = /^webpack:\/\/exports\//
var externalSource = /^external/
function supportRelativeURL(file, url) {
  if (!file) return url
  var webpackURL = url
  var webpackMatch = webpackSource.exec(webpackURL)
  if (webpackMatch) {
    webpackURL = webpackURL.slice(webpackMatch[0].length)
    if (externalSource.exec(webpackURL)) {
      return webpackURL
    }
    webpackURL = '../../../' + webpackURL
  }
  var dir = path.dirname(file)
  var match = /^\w+:\/\/[^/]*/.exec(dir)
  var protocol = match ? match[0] : ''
  return protocol + path.resolve(dir.slice(protocol.length), webpackURL)
}

function retrieveSourceMapURL(source, caches) {
  // Get the URL of the source map
  var fileData = retrieveFile(source, caches)

  var re = /(?:\/\/[@#][ \t]+sourceMappingURL=([^\s'"]+?)[ \t]*$)|(?:\/\*[@#][ \t]+sourceMappingURL=([^*]+?)[ \t]*(?:\*\/)[ \t]*$)/gm
  // Keep executing the search to find the *last* sourceMappingURL to avoid
  // picking up sourceMappingURLs from comments, strings, etc.
  var lastMatch
  var match = re.exec(fileData)
  while (match) {
    lastMatch = match
    match = re.exec(fileData)
  }
  if (!lastMatch) return null
  return lastMatch[1]
}

// Can be overridden by the retrieveSourceMap option to install. Takes a
// generated source filename; returns a {map, optional url} object, or null if
// there is no source map.  The map field may be either a string or the parsed
// JSON object (ie, it must be a valid argument to the SourceMapConsumer
// constructor).
function retrieveSourceMap(source, caches) {
  var sourceMappingURL = retrieveSourceMapURL(source, caches)
  if (!sourceMappingURL) return null

  // Read the contents of the source map
  var sourceMapData
  if (reSourceMap.test(sourceMappingURL)) {
    // Support source map URL as a data url
    var rawData = sourceMappingURL.slice(sourceMappingURL.indexOf(',') + 1)
    sourceMapData = Buffer.from(rawData, 'base64').toString()
    sourceMappingURL = source
  } else {
    // Support source map URLs relative to the source URL
    sourceMappingURL = supportRelativeURL(source, sourceMappingURL)
    sourceMapData = retrieveFile(sourceMappingURL, caches)
  }

  if (!sourceMapData) {
    return null
  }

  return {
    url: sourceMappingURL,
    map: sourceMapData,
  }
}

function mapSourcePosition(position, caches) {
  var sourceMap = caches.sourceMap[position.source]

  if (!sourceMap) {
    var urlAndMap = retrieveSourceMap(position.source, caches)
    if (urlAndMap) {
      var map = new SourceMapConsumer(urlAndMap.map)
      sourceMap = {
        url: urlAndMap.url,
        rawMap: urlAndMap.map,
        map: map,
      }

      caches.sourceMap[position.source] = sourceMap

      // Load all sources stored inline with the source map into the file cache
      // to pretend like they are already loaded. They may not exist on disk.
      if (sourceMap.map.sourcesContent) {
        sourceMap.map.sources.forEach((source, i) => {
          const contents = sourceMap.map.sourcesContent[i]
          if (contents) {
            const url = supportRelativeURL(sourceMap.url, source)
            caches.fileContents[url] = contents
          }
        })
      }
    } else {
      sourceMap = {
        url: null,
        rawMap: null,
        map: null,
      }

      caches.sourceMap[position.source] = sourceMap
    }
  }

  // Resolve the source URL relative to the URL of the source map
  if (sourceMap && sourceMap.map) {
    const originalPosition = sourceMap.map.originalPositionFor(position)

    // Only return the original position if a matching line was found. If no
    // matching line is found then we return position instead, which will cause
    // the stack trace to print the path and line for the compiled file. It is
    // better to give a precise location in the compiled file than a vague
    // location in the original file.
    if (originalPosition.source !== null) {
      originalPosition.source =
        supportRelativeURL(sourceMap.url, originalPosition.source) ||
        originalPosition.source
      return originalPosition
    }
  }

  return position
}

module.exports = function(stack) {
  const caches = {
    // Maps a file path to a string containing the file contents
    fileContents: {},
    // Maps a file path to a source map for that file
    sourceMap: {},
  }

  var mappedStack = []

  for (let i = 0; i < stack.length; i += 1) {
    var frame = stack[i]
    if (
      typeof frame.line !== 'undefined' &&
      typeof frame.column !== 'undefined' &&
      frame.filePath
    ) {
      var mappedPosition = mapSourcePosition(
        {
          source: frame.filePath,
          line: parseInt(frame.line, 10),
          column: parseInt(frame.column, 10),
        },
        caches
      )
      var filePath = mappedPosition.source
      // the file is the last part of the filePath
      var file = filePath.split('/')
      file = file[file.length - 1]
      mappedStack.push(Object.assign({}, frame, mappedPosition, {
        filePath: filePath,
        file: file,
      }))
    } else {
      mappedStack.push(frame)
    }
  }

  return mappedStack
}

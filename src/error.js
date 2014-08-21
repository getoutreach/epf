var errorProps = [
  'description',
  'fileName',
  'lineNumber',
  'message',
  'name',
  'number',
  'stack'
];

/**
  A subclass of the JavaScript Error object for use in Coalesce.

  @class Error
  @extends Error
  @constructor
*/
function CsError() {
  var tmp = Error.apply(this, arguments);

  // Adds a `stack` property to the given error object that will yield the
  // stack trace at the time captureStackTrace was called.
  // When collecting the stack trace all frames above the topmost call
  // to this function, including that call, will be left out of the
  // stack trace.
  // This is useful because we can hide Coalesce implementation details
  // that are not very helpful for the user.
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, CsError);
  }
  // Unfortunately errors are not enumerable in Chrome (at least), so `for prop in tmp` doesn't work.
  for (var idx = 0; idx < errorProps.length; idx++) {
    this[errorProps[idx]] = tmp[errorProps[idx]];
  }
}

CsError.prototype = Object.create(Error.prototype);

export default CsError;

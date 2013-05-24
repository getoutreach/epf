var fs = require('fs');
var EmberScript = require ('ember-script');
require.extensions['.em'] = function(module, filename) {
  var content;
  content = fs.readFileSync(filename, 'utf8');
  var compiled = EmberScript.em2js(content);
  return module._compile(compiled, filename);
};
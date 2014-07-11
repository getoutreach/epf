var fs = require('fs');
var transpileES6 = require('broccoli-es6-module-transpiler');
var pickFiles = require('broccoli-static-compiler');
var mergeTrees = require('broccoli-merge-trees');
var writeFile = require('broccoli-file-creator');
var moveFile = require('broccoli-file-mover');
var findBowerTrees = require('broccoli-bower');
var concat = require('broccoli-concat');
var uglify = require('broccoli-uglify-js');
var removeFile = require('broccoli-file-remover');
var defeatureify = require('broccoli-defeatureify');
var emberScript = require('broccoli-ember-script');
var replace = require('broccoli-replace');

var calculateVersion = require('./lib/calculate-version');

var licenseJs = fs.readFileSync('./generators/license.js').toString();

var es6Modules = (function() {
  var tree = pickFiles('src', {
    srcDir: '/',
    destDir: 'epf'
  });
  var vendoredPackage = moveFile(tree, {
    srcFile: 'epf/main.js',
    destFile: '/epf.js'
  });
  tree = mergeTrees([tree, vendoredPackage]);
  tree = removeFile(tree,  {
    files: ['epf/main.js']
  });
  var transpiled = transpileES6(tree, {
    moduleName: true,
  });
  return concat(transpiled, {
    inputFiles: ['**/*.js'],
    outputFile: '/epf-modules.js'
  });
})();


var es6TestModules = (function() {
  var tree = pickFiles('test', {
    srcDir: '/',
    destDir: 'epf-test'
  });

  tree = emberScript(tree, {
    bare: true
  });

  var transpiled = transpileES6(tree, {
    moduleName: true,
  });
  return concat(transpiled, {
    inputFiles: ['**/*.js'],
    outputFile: '/epf-test-modules.js'
  });
})();


var devDist = (function() {

  var iifeStart = writeFile('iife-start', '(function() {');
  var iifeStop  = writeFile('iife-stop', '})();');
  var bootstrap = writeFile('bootstrap', 'this.Ep = requireModule("epf")["default"];\n');

  var trees = findBowerTrees().concat(['vendor', iifeStart, iifeStop, bootstrap, es6Modules]);

  return concat(mergeTrees(trees), {
    inputFiles: [
      'iife-start',
      'ember-inflector.js',
      'bundle.js', // jsondiffpatch dist
      'loader.js',
      'epf-modules.js',
      'bootstrap',
      'iife-stop'
    ],
    outputFile: '/epf.js'
  });

})();


var prodDist = (function() {

  var tree = moveFile(devDist, {
    srcFile: 'epf.js',
    destFile: '/epf.prod.js'
  });

  tree = defeatureify(tree, {
    enabled: true,
    enableStripDebug: true,
    debugStatements: [
      "Ember.warn",
      "emberWarn",
      "Ember.assert",
      "emberAssert",
      "Ember.deprecate",
      "emberDeprecate",
      "Ember.debug",
      "emberDebug",
      "Ember.Logger.info",
      "Ember.runInDebug",
      "runInDebug"
    ]
  });

  return tree;

})();

var minDist = (function() {

  var tree = moveFile(prodDist, {
    srcFile: 'epf.prod.js',
    destFile: '/epf.min.js'
  });
  return uglify(tree);

})();

distTree = mergeTrees([es6Modules, es6TestModules, devDist, prodDist, minDist]);
distTree = replace(distTree, {
  files: [ '**/*.js' ],
  patterns: [
    { match: /^/, replacement: licenseJs }
  ]
});
distTree = replace(distTree, {
  files: [ '**/*.js' ],
  patterns: [
    { match: /VERSION_STRING_PLACEHOLDER/g, replacement: calculateVersion }
  ]
});

module.exports = distTree;

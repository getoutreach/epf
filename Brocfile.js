var fs = require('fs');
var traceur = require('broccoli-traceur');
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
var coffee = require('broccoli-coffee');
var replace = require('broccoli-replace');
var yuidocCompiler = require('broccoli-yuidoc');

var calculateVersion = require('./lib/calculate-version');

var licenseJs = fs.readFileSync('./generators/license.js').toString();

var es6Modules = (function() {
  var tree = pickFiles('src', {
    srcDir: '/',
    destDir: 'coalesce'
  });
  var vendoredPackage = moveFile(tree, {
    srcFile: 'coalesce/main.js',
    destFile: '/coalesce.js'
  });

  tree = mergeTrees([tree, vendoredPackage]);
  tree = removeFile(tree,  {
    files: ['coalesce/main.js']
  });
  var transpiled = traceur(tree, {
    moduleName: true,
    modules: 'amd',
    annotations: true
  });
  return concat(transpiled, {
    inputFiles: ['**/*.js'],
    outputFile: '/coalesce-modules.js'
  });
})();


var es6TestModules = (function() {
  var tree = pickFiles('test', {
    srcDir: '/',
    destDir: 'coalesce-test'
  });

  tree = emberScript(tree, {
    bare: true
  });
  
  tree = coffee(tree, {
    bare: true
  });

  var transpiled = traceur(tree, {
    moduleName: true,
    modules: 'amd'
  });
  return concat(transpiled, {
    inputFiles: ['**/*.js'],
    outputFile: '/coalesce-test-modules.js'
  });
})();


var devDist = (function() {

  var iifeStart = writeFile('iife-start', '(function() {');
  var iifeStop  = writeFile('iife-stop', '})();');
  var bootstrap = writeFile('bootstrap', 'this.Ep = requireModule("coalesce")["default"];\n');

  var trees = findBowerTrees().concat(['vendor', iifeStart, iifeStop, bootstrap, es6Modules]);

  return concat(mergeTrees(trees), {
    inputFiles: [
      'iife-start',
      'ember-inflector.js',
      'bundle.js', // jsondiffpatch dist
      'loader.js',
      'traceur-runtime.js',
      'coalesce-modules.js',
      'bootstrap',
      'iife-stop'
    ],
    outputFile: '/coalesce.js'
  });

})();


var prodDist = (function() {

  var tree = moveFile(devDist, {
    srcFile: 'coalesce.js',
    destFile: '/coalesce.prod.js'
  });

  tree = defeatureify(tree, {
    enabled: true,
    enableStripDebug: true,
    debugStatements: [
      "console.assert"
    ]
  });

  return tree;

})();

var minDist = (function() {

  var tree = moveFile(prodDist, {
    srcFile: 'coalesce.prod.js',
    destFile: '/coalesce.min.js'
  });
  return uglify(tree);

})();

var bowerJSON = writeFile('bower.json', JSON.stringify({
  name: 'coalesce',
  version: 'VERSION_STRING_PLACEHOLDER',
  license: "MIT",
  main: 'coalesce.js',
  keywords: [
    "ember.js",
    "orm",
    "persistence",
    "sync"
  ]
}, null, 2));

distTree = mergeTrees([bowerJSON, es6Modules, es6TestModules, devDist, prodDist, minDist]);
distTree = replace(distTree, {
  files: [ '**/*.js' ],
  patterns: [
    { match: /^/, replacement: licenseJs }
  ]
});
distTree = replace(distTree, {
  files: [ '**/*' ],
  patterns: [
    { match: /VERSION_STRING_PLACEHOLDER/g, replacement: calculateVersion }
  ]
});

var docs = yuidocCompiler('src', {
  srcDir: '/',
  destDir: 'docs'
});

module.exports = mergeTrees([docs, distTree]);

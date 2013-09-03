require('../vendor/ember-inflector');
Ember.Inflector.loadAll();

global.Ep = Ember.Namespace.create();

require('./version');

require('./initializer');
require('./model');
require('./session');
require('./serializer');
require('./transforms');

require('./local');
require('./rest');

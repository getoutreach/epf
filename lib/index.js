require('../vendor/ember-inflector');

global.Ep = Ember.Namespace.create();

require('./version');

require('./initializers');
require('./model');
require('./session');
require('./serializer');
require('./transforms');

require('./local');
require('./rest');

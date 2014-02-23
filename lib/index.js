require('../vendor/ember-inflector');

global.Ep = Ember.Namespace.create();

require('./version');

require('./initializers');
require('./model');
require('./session');
require('./serializers');

require('./local');
require('./rest');

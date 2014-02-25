require('../vendor/ember-inflector');

global.Ep = Ember.Namespace.create();

require('./version');

require('./initializers');
require('./model');
require('./session');
require('./serializers');
require('./merge_strategies');

require('./local');
require('./rest');

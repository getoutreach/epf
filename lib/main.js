
global.Ep = Ember.Namespace.create();

require('./model');
require('./attribute');
require('./relationships/belongs_to');
require('./relationships/ext');
require('./relationships/has_many');
require('./rest_serializer');
require('./rest_adapter');
require('./store');
require('./session');
require('./application_ext');
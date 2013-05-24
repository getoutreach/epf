
global.Orm = Ember.Namespace.create();
global.DS = Orm; // temporary

require('./model');
require('./attribute');
require('./relationships/belongs_to');
require('./relationships/ext');
require('./relationships/has_many');
//require('./relationships/one_to_many_change');
require('./rest_serializer');
require('./rest_adapter');
require('./store');
require('./session');
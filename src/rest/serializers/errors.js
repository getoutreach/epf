var get = Ember.get, set = Ember.set, isEmpty = Ember.isEmpty;

import RestErrors from '../rest_errors';
import Serializer from '../../serializers/base';

export default Serializer.extend({

  deserialize: function(serialized, opts) {
    var xhr = opts && opts.xhr;
    
    if(!xhr && (isEmpty(serialized) || isEmptyObject(serialized))) return;
    
    var content = {};
    for(var key in serialized) {
      content[this.transformPropertyKey(key)] = serialized[key];
    }
    
    var res = RestErrors.create({
      content: content
    });
    
    if(xhr) {
      set(res, 'status', xhr.status);
      set(res, 'xhr', xhr);
    }
    
    return res;
  },
  
  transformPropertyKey: function(name) {
    return Ember.String.camelize(name);
  },

  serialize: function(id) {
    throw new Ember.Error("Errors are not currently serialized down to the server.");
  }

});

function isEmptyObject(obj) {
  return Ember.keys(obj).length === 0;
}

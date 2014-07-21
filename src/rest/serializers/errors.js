var get = Ember.get, set = Ember.set, isEmpty = Ember.isEmpty;

import RestErrors from '../rest_errors';
import Serializer from '../../serializers/base';

export default class ErrorsSerializer extends Serializer {

  deserialize(serialized, opts) {
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
  }
  
  transformPropertyKey(name) {
    return Ember.String.camelize(name);
  }

  serialize(id) {
    throw new Ember.Error("Errors are not currently serialized down to the server.");
  }

}

function isEmptyObject(obj) {
  return Ember.keys(obj).length === 0;
}

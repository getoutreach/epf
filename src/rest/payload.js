var isArray = Ember.isArray;

import ModelSet from '../collections/model_set';

class Payload extends ModelSet {

  constructor(iterable) {
    super(iterable)
    this.isPayload = true;
    this.context = null;
    this.meta = null;
  }
  
  merge(session) {
    var merged = Array.from(this).map(function(model) {
      return session.merge(model);
    }, this);
    var context = this.context;
    if(context && isArray(context)) {
      context = context.map(function(model) {
        return session.getModel(model);
      });
    } else if(context) {
      context = session.getModel(context);
    }
    var result = new Payload(merged);
    result.context = context;
    result.meta = this.meta;
    result.errors = this.errors;
    return result;
  }

}

export default Payload;

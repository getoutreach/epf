var get = Ember.get, set = Ember.set;

import Errors from '../model/errors';


class RestErrors extends Errors {
  
  constructor(opts) {
    super(opts.content);
    this.xhr = opts.xhr;
    this.status = opts.status;
  }
  
  copy() {
    var res = super();
    res.xhr = this.xhr;
    res.stats = this.status;
    return res;
  }
  
}

export default RestErrors;

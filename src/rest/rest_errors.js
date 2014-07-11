var get = Ember.get, set = Ember.set;

import Errors from '../model/errors';

var RestErrors = Errors.extend({

  status: null,
  xhr: null,

  copy: function() {
    return RestErrors.create({
      content: Ember.copy(this.content),
      status: this.status,
      xhr: this.xhr
    });
  }

});

export default RestErrors;
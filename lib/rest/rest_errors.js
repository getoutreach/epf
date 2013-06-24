var get = Ember.get, set = Ember.set;

Ep.RestErrors = Ep.Errors.extend({

  status: null,
  xhr: null,

  copy: function() {
    return Ep.RestErrors.create({
      content: Ember.copy(this.content),
      status: this.status,
      xhr: this.xhr
    });
  }

});
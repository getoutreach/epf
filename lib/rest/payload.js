var get = Ember.get, set = Ember.set;

Ep.Payload = Ep.ModelSet.extend({

  isPayload: true,
  context: null,
  meta: null,

  merge: function(session) {
    var merged = this.map(function(model) {
      return session.merge(model);
    }, this);
    var context = get(this, 'context');
    if(context && Ember.isArray(context)) {
      context = context.map(function(model) {
        return session.getModel(model);
      });
    } else if(context) {
      context = session.getModel(context);
    }
    var result = Ep.Payload.fromArray(merged);
    result.context = context;
    result.meta = this.meta;
    return result;
  }

});

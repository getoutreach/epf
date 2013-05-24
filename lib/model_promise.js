function triggerLoad() {
  return function() {
    this._super.apply(this, arguments);
    this.load();
  }
}

// TODO: what about immediate model promises?

/**
  Represents the promise of a model
*/
Orm.ModelPromise = Ember.ObjectProxy.extend(Ember.DeferredMixin, {

  id: null,
  type: null,
  session: null,

});


Orm.LazyModelPromise = Orm.ModelPromise.extend({

  willWatchProperty: triggerLoad(),
  unknownProperty: triggerLoad(),
  setUnknownProperty: triggerLoad(),
  then: triggerLoad(),

  load: function() {
    proxy = this;
    return this.session.load(this.type, this.id).then(function(model) {
      return Ember.set(proxy, 'content', 'model');
    });
  }

});
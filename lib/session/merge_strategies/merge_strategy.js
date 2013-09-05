var get = Ember.get, set = Ember.set;

function mustImplement(name) {
  return function() {
    throw new Ember.Error("Your merge strategy " + this.toString() + " does not implement the required method " + name);
  };
}

Ep.MergeStrategy = Ember.Object.extend({

  session: null,

  merge: mustImplement('merge')

});
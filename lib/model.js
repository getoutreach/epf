var get = Ember.get, set = Ember.set;

Orm.ModelMixin = Ember.Mixin.create({

  id: null,
  session: null,

  /**
    Two models are equal when they correspond to the same
    key. This does not mean they have the same data.
  */
  equals: function(model) {
    Ember.assert("Cannot compare models of different types.", model.constructor === this.constructor);
    return get(model, 'clientId') == get(this, 'clientId')
      || get(model, 'id') && get(model, 'id') == get(this, 'id');
  }

});

Orm.Model = Ember.Object.extend(Ember.Copyable, Orm.ModelMixin, {

  isDeleted: false,
  isLoaded: true,

  isNew: Ember.computed(function() {
    return !get(this, 'id');
  }).property('id'),

  // TODO: volatile isDirty

  copy: function() {
    var copy = this.constructor.create();
    set(copy, 'id', get(this, 'id'));
    set(copy, 'clientId', get(this, 'id'));
    // TODO: revision?
    this.eachAttribute(function(name, meta) {
      set(copy, name, get(this, name));
    }, this);
    // TODO: relationships
    return copy;
  },

  diff: function(model) {
    var diffs = [];

    // TODO: for now we are checking entire fields
    this.eachAttribute(function(name, meta) {
      var left = get(this, name);
      var right = get(model, name);
      if(left instanceof Date && right instanceof Date) {
        left = left.getTime();
        right = right.getTime();
      }
      if(left !== right) {
        // eventually we will have an actual diff
        diffs.push({name: name});
      }
    }, this);

    // TODO: relationships
    return diffs;
  },

  _suspendedRelationships: false,

  /**
    @private

    The goal of this method is to temporarily disable specific observers
    that take action in response to application changes.

    This allows the system to make changes (such as materialization and
    rollback) that should not trigger secondary behavior (such as setting an
    inverse relationship or marking records as dirty).

    The specific implementation will likely change as Ember proper provides
    better infrastructure for suspending groups of observers, and if Array
    observation becomes more unified with regular observers.
  */
  suspendRelationshipObservers: function(callback, binding) {
    var observers = get(this.constructor, 'relationshipNames').belongsTo;
    var self = this;

    try {
      this._suspendedRelationships = true;
      Ember._suspendObservers(self, observers, null, 'belongsToDidChange', function() {
        Ember._suspendBeforeObservers(self, observers, null, 'belongsToWillChange', function() {
          callback.call(binding || self);
        });
      });
    } finally {
      this._suspendedRelationships = false;
    }
  },

});
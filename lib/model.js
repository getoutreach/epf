var get = Ember.get, set = Ember.set;

Orm.Model = Ember.Object.extend(Ember.Copyable, {

  session: null,

  isNew: Ember.computed(function() {
    return !get(this, 'id');
  }).property('id'),

  isDeleted: false,

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
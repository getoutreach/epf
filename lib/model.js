var get = Ember.get, set = Ember.set;

Orm.Model = Ember.Object.extend(Ember.Copyable, {

  session: null,
  
  clientId: Ember.computed(function() {
    return Ember.guidFor(this);
  }),

  isNew: Ember.computed(function() {
    return !!get(this, 'id');
  }).property('id'),

  isDeleted: false,

  // TODO: volatile isDirty

  copy: function() {
    var copy = this.constructor.create();
    set(copy, 'id', this.get('id'));
    // TODO: revision?
    this.eachAttribute(function(name, meta) {
      set(copy, name, get(this, name));
    }, this);
    // TODO: relationships
    return copy;
  }

});
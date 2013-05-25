var get = Ember.get, set = Ember.set, forEach = Ember.ArrayPolyfills.forEach;

require("../model");
require("../model_array");

Orm.hasMany = function(type, options) {
  Ember.assert("The type passed to Orm.hasMany must be defined", !!type);
  options = options || {};

  var meta = { type: type, isRelationship: true, options: options, kind: 'hasMany' };

  return Ember.computed(function(key, value) {
    return Orm.HasManyArray.create({
      owner: this,
      name: key,
      content:[]
    });
  }).property().meta(meta);
};

Orm.HasManyArray = Orm.ModelArray.extend({

  name: null,
  owner: null,

  arrangedContentDidChange: function() {
    // TODO
    //this.fetch();
  },

  arrayContentWillChange: function(index, removed, added) {
    var owner = get(this, 'owner'),
        name = get(this, 'name');

    if (!owner._suspendedRelationships) {
      // This code is the first half of code that continues inside
      // of arrayContentDidChange. It gets or creates a change from
      // the child object, adds the current owner as the old
      // parent if this is the first time the object was removed
      // from a ManyArray, and sets `newParent` to null.
      //
      // Later, if the object is added to another ManyArray,
      // the `arrayContentDidChange` will set `newParent` on
      // the change.
      var inverse = owner.constructor.inverseFor(name);
      if(inverse) {
        for (var i=index; i<index+removed; i++) {
          var model = this.objectAt(i);

          if(!get(model, 'isLoaded')) continue;

          model.suspendRelationshipObservers(function() {
            if(inverse.kind === 'hasMany') {
              get(model, inverse.name).removeObject(owner)
            } else if(inverse.kind === 'belongsTo') {
              set(model, inverse.name, null);
            }
          });
        }
      }
    }

    return this._super.apply(this, arguments);
  },

  arrayContentDidChange: function(index, removed, added) {
    this._super.apply(this, arguments);

    var owner = get(this, 'owner'),
        name = get(this, 'name');

    if (!owner._suspendedRelationships) {
      // This code is the second half of code that started in
      // `arrayContentWillChange`. It gets or creates a change
      // from the child object, and adds the current owner as
      // the new parent.
      var inverse = owner.constructor.inverseFor(name);
      if(inverse) {
        for (var i=index; i<index+added; i++) {
          var model = this.objectAt(i);

          if(!get(model, 'isLoaded')) continue;

          model.suspendRelationshipObservers(function() {
            if(inverse.kind === 'hasMany') {
              get(model, inverse.name).addObject(owner)
            } else if(inverse.kind === 'belongsTo') {
              set(model, inverse.name, owner);
            }
          });
        }

        // TODO: think through the below reasoning
        // We wait until the array has finished being
        // mutated before syncing the OneToManyChanges created
        // in arrayContentWillChange, so that the array
        // membership test in the sync() logic operates
        // on the final results.
        // this._changesToSync.forEach(function(change) {
        //   change.sync();
        // });
        // DS.OneToManyChange.ensureSameTransaction(this._changesToSync, store);
        // this._changesToSync.clear();
      }
    }
  },

});


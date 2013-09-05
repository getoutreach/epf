var get = Ember.get, set = Ember.set;

/**
  This default merge strategy is not version aware. It
  uses a set to break cycles in the merge.
*/
Ep.Theirs = Ep.MergeStrategy.extend({

  merge: function(dest, ancestor, model) {
    dest.beginPropertyChanges();
    this.copyAttributes(model, dest);
    this.copyMeta(model, dest);
    this.copyRelationships(model, dest);
    dest.endPropertyChanges();
    return dest;
  },

  copyAttributes: function(model, dest) {
    model.eachAttribute(function(name, meta) {
      // TODO: handle non-primitive attributes
      var left = get(model, name);
      var right = get(dest, name);
      if(left !== right) set(dest, name, left);
    });
  },

  copyRelationships: function(model, dest) {
    var session = get(this, 'session');
    model.eachRelationship(function(name, relationship) {
      if(relationship.kind === 'belongsTo') {
        var child = get(model, name);
        var destChild = get(dest, name);
        if(child) {
          set(dest, name, child);
        } else if(destChild) {
          set(dest, name, null);
        }
      } else if(relationship.kind === 'hasMany') {
        var children = get(model, name);
        var destChildren = get(dest, name);
        var modelSet = Ep.ModelSet.create();
        modelSet.pushObjects(destChildren);

        // TODO: need meta here?
        set(destChildren, 'meta', get(children, 'meta'));
        children.forEach(function(child) {
          if(modelSet.contains(child)) {
            modelSet.remove(child);
          } else {
            destChildren.addObject(child);
          }
        }, this);
        destChildren.removeObjects(modelSet);
      }
    }, this);
  }

});


var get = Ember.get, set = Ember.set;

Orm.ModelArray = Ember.ArrayProxy.extend({

  merge: function(dest, cache) {
    if(!cache) cache = Orm.ModelCache.create();

    existing = Orm.ModelCache.create();
    dest.forEach(function(model) {
      reuse.add(model);
    });
    dest.clear();

    this.forEach(function(model) {
      var reuse;
      if(reuse = existing.getForModel(model)) {
        model.merge(reuse, cache);
        dest.addObject(reuse);
      } else {
        dest.addObject(model.copy(cache));
      }
    });
  }

});
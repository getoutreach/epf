var get = Ember.get, set = Ember.set;

import ModelSet from '../collections/model_set';

/**
  Given a collection of models, make sure all lazy
  models/relations are replaced with their materialized counterparts
  if they exist within the collection.
*/
export default function materializeRelationships(models, idManager) {

  if(!(models instanceof ModelSet)) {
    models = ModelSet.fromArray(models);
  }

  models.forEach(function(model) {

    // TODO: does this overwrite non-lazy embedded children?
    model.eachLoadedRelationship(function(name, relationship) {
      if(relationship.kind === 'belongsTo') {
        var child = get(model, name);
        if(child) {
          if(idManager) idManager.reifyClientId(child);
          child = models.getModel(child) || child;
          set(model, name, child);
        }
      } else if(relationship.kind === 'hasMany') {
        // TODO: merge could be per item
        var children = get(model, name);
        var lazyChildren = ModelSet.create();
        lazyChildren.addObjects(children);
        children.clear();
        lazyChildren.forEach(function(child) {
          if(idManager) idManager.reifyClientId(child);
          child = models.getModel(child) || child;
          children.addObject(child);
        });
      }
    }, this);

  }, this);

}

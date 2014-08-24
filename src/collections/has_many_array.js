import ModelArray from '../collections/model_array';

export default class HasManyArray extends ModelArray {
  
  get session() {
    return this.owner && this.owner.session;
  }
  
  replace(idx, amt, objects) {
    if(this.session) {
      objects = objects.map(function(model) {
        return this.session.add(model);
      }, this);
    }
    super(idx, amt, objects);
  }

  arrayContentWillChange(index, removed, added) {
    var model = this.owner,
        name = this.name,
        session = this.session;

    if(session) {
      session.modelWillBecomeDirty(model);
      if (!model._suspendedRelationships) {
        for (var i=index; i<index+removed; i++) {
          var inverseModel = this.objectAt(i);
          session.inverseManager.unregisterRelationship(model, name, inverseModel);
        }
      }
    }

    return super(index, removed, added);
  }

  arrayContentDidChange(index, removed, added) {
    super(index, removed, added);

    var model = this.owner,
        name = this.name,
        session = this.session;

    if (session && !model._suspendedRelationships) {
      for (var i=index; i<index+added; i++) {
        var inverseModel = this.objectAt(i);
        session.inverseManager.registerRelationship(model, name, inverseModel);
      }
    }
  }

}

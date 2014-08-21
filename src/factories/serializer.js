var get = Ember.get;

/**
  @namespace factory
  @class SerializerFactory
*/
export default class SerializerFactory {

  constructor(container) {
    this.container = container;
  }

  serializerFor(typeKey) {
    console.assert(typeof typeKey === 'string', 'Passed in typeKey must be a string');
    var serializer = this.container.lookup('serializer:' + typeKey);
    // if no serializer exists and this typeKey corresponds to a model
    // then create a default serializer
    if(!serializer) {
      var modelExists = !!this.container.lookupFactory('model:' + typeKey);
      if(!modelExists) return;
      var Serializer = this.container.lookupFactory('serializer:model');
      this.container.register('serializer:' + typeKey, Serializer);
      serializer = this.container.lookup('serializer:' + typeKey);
    }

    if (!serializer.typeKey) {
      serializer.typeKey = typeKey;
    }

    return serializer;
  }

  serializerForType(type) {
    return this.serializerFor(get(type, 'typeKey'));
  }

  serializerForModel(model) {
    var type = model.constructor;
    return this.serializerForType(type);
  }

}
/**
  @namespace factory
  @class SerializerFactory
*/
export default class TypeFactory {

  constructor(container) {
    this.container = container;
  }

  typeFor(typeKey) {
    var factory = this.container.lookupFactory('model:' + typeKey);

    Ember.assert("No model was found for '" + typeKey + "'", factory);

    factory.session = this;
    factory.typeKey = typeKey;

    return factory;
  }

}
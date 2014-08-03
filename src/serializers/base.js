import SerializerFactory from '../factories/serializer';
import BaseClass from '../utils/base_class';

/**
  Base class for serialization/deserialization

  @namespace serializers
  @class Base
*/
export default class Base extends BaseClass {

  constructor() {
    this.serializerFactory = new SerializerFactory(this.container);
  }

  serialize() {}
  
  deserialize() {}

  serializerFor(typeKey) {
    return this.serializerFactory.serializerFor(typeKey);
  }

}

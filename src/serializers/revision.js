var empty = Ember.isEmpty;

import Serializer from './base';

/**
  @namespace serializers
  @class RevisionSerializer
*/
export default class RevisionSerializer extends Serializer {

  deserialize(serialized) {
    return serialized ? serialized : undefined;
  }

  serialize(deserialized) {
    return deserialized ? deserialized : undefined;
  }
}
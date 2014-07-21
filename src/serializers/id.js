import Serializer from './base';

/**
  @namespace serializers
  @class IdSerializer
*/
export default class IdSerializer extends Serializer {

  deserialize(serialized) {
    if(serialized === undefined || serialized === null) return;
    return serialized+'';
  }

  serialize(id) {
    if (isNaN(id) || id === null) { return id; }
    return +id;
  }

}

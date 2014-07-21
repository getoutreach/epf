import ModelSerializer from '../../serializers/model';

export default class ActiveModelSerializer extends ModelSerializer {

  keyForType(name, type, opts) {
    var key = this._super(name, type);
    if(!opts || !opts.embedded) {
      if(type === 'belongs-to') {
        return key + '_id';
      } else if(type === 'has-many') {
        return Ember.String.singularize(key) + '_ids';
      }
    }
    return key;
  }

}
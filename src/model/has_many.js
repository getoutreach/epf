import Field from './field';
import HasManyArray from '../collections/has_many_array';
import isEqual from '../utils/is_equal';
import copy from '../utils/copy';

export default class HasMany extends Field {
  
  // get kind() {
  //   return 'hasMany';
  // }
  
  defineProperty(prototype) {
    var name = this.name;
    Object.defineProperty(prototype, name, {
      enumerable: true,
      get: function() {
        var value = this._relationships[name];
        if(this.isNew && !value) {
          value = this._relationships[name] = HasManyArray.create({
            owner: this,
            name: name,
            content: []
          });
        }
        return value;
      },
      set: function(value) {
        var oldValue = this._relationships[name];
        if(oldValue === value) return;
        if(value && value instanceof HasManyArray) {
          // need to copy since this content is being listened to
          value = copy(value.content);
        }
        if(oldValue && oldValue instanceof HasManyArray) {
          oldValue.content = value;
        } else {
          this.hasManyWillChange(name);
          value = this._relationships[name] = HasManyArray.create({
            owner: this,
            name: name,
            content: value
          });
          this.hasManyDidChange(name);
        }
        return value;
      }
    });
  }
  
}

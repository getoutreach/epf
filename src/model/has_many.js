import Field from './field';
import HasManyArray from '../collections/has_many_array';
import isEqual from '../utils/is_equal';

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
        var oldValue = this._attributes[name];
        if(isEqual(oldValue, value)) return;
        if(oldValue && oldValue instanceof HasManyArray) {
          // XXX: make sure the content is not an ArrayProxy
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

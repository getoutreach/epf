import Field from './field';
import isEqual from '../utils/is_equal';

export default class Attribute extends Field {
  
  get kind() {
    return 'attribute';
  }
  
  defineProperty(prototype) {
    var name = this.name;
    Object.defineProperty(prototype, name, {
      enumerable: true,
      get: function() {
        return this._attributes[name];
      },
      set: function(value) {
        var oldValue = this._attributes[name];
        if(isEqual(oldValue, value)) return;
        this.attributeWillChange(name);
        this._attributes[name] = value;
        this.attributeDidChange(name);
        return value;
      }
    });
  }
  
}

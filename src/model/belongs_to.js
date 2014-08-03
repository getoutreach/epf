import Field from './field';
import isEqual from '../utils/is_equal';

export default class BelongsTo extends Field {
  
  // get kind() {
  //   return 'belongsTo';
  // }
  
  defineProperty(prototype) {
    var name = this.name;
    Object.defineProperty(prototype, name, {
      enumerable: true,
      get: function() {
        var value = this._relationships[name],
            session = this.session;
        if(session && value && value.session !== session) {
          value = this._relationships[name] = this.session.add(value);
        }
        return value;
      },
      set: function(value) {
        var oldValue = this._attributes[name];
        if(isEqual(oldValue, value)) return;
        this.belongsToWillChange(name);
        var session = this.session;
        if(session) {
          session.modelWillBecomeDirty(this);
          value = session.add(value);
        }
        this._relationships[name] = value;
        this.belongsToDidChange(name);
        return value;
      }
    });
  }
  
}

/**
  Abstract base class for attributes and relationships
  @class Field
*/
export default class Field {
  
  constructor(name, options) {
    this.name = name;
    for(var key in options) {
      if(!options.hasOwnProperty(key)) continue;
      this[key] = options[key];
    }
  }
  
}

function _lazyCopy(obj, deep, seen, copies) {
  var ret, loc, key;

  // primitive data types are immutable, just return them.
  if ('object' !== typeof obj || obj===null) return obj;
  if (obj.lazyCopy && typeof obj.lazyCopy === 'function') return obj.lazyCopy(deep);
  if (obj.copy && typeof obj.copy === 'function') return obj.copy(deep);

  // avoid cyclical loops
  if (deep && (loc=seen.indexOf(obj))>=0) return copies[loc];

  if (obj instanceof Array) {
    ret = obj.slice();
    if (deep) {
      loc = ret.length;
      while(--loc>=0) ret[loc] = _lazyCopy(ret[loc], deep, seen, copies);
    }
  } else if (obj instanceof Date) {
    ret = new Date(obj.getTime());
  } else {
    ret = {};
    for(key in obj) {
      if (!obj.hasOwnProperty(key)) continue;

      // Prevents browsers that don't respect non-enumerability from
      // copying internal Ember properties
      if (key.substring(0,2) === '__') continue;

      ret[key] = deep ? _lazyCopy(obj[key], deep, seen, copies) : obj[key];
    }
  }

  if (deep) {
    seen.push(obj);
    copies.push(ret);
  }

  return ret;
}

/**
  Similar to `copy` but checks for a `lazyCopy` method first.

  @method lazyCopy
  @param {Object} obj The object to clone
  @param {Boolean} deep If true, a deep copy of the object is made
  @return {Object} The cloned object
*/
export default function lazyCopy(obj, deep) {
  return _lazyCopy(obj, deep, deep ? [] : null, deep ? [] : null);
}

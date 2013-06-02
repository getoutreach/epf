var get = Ember.get, set = Ember.set;

Ep.rpc = function(name) {
  return function() {
    var session = get(this, 'session');
    return session.applyRemote(this, name, arguments);
  }
}
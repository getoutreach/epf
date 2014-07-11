Ember.LOG_STACKTRACE_ON_DEPRECATION = false;

var syncForTest = function(fn) {
  var callSuper;

  if (typeof fn !== "function") { callSuper = true; }

  return function() {
    var override = false, ret;

    if (Ember.run && !Ember.run.currentRunLoop) {
      Ember.run.begin();
      override = true;
    }

    try {
      if (callSuper) {
        ret = this._super.apply(this, arguments);
      } else {
        ret = fn.apply(this, arguments);
      }
    } finally {
      if (override) {
        Ember.run.end();
      }
    }

    return ret;
  };
};

Ember.config.overrideAccessors = function() {
  Ember.set = syncForTest(Ember.set);
  Ember.get = syncForTest(Ember.get);
};

Ember.config.overrideClassMixin = function(ClassMixin) {
  ClassMixin.reopen({
    create: syncForTest()
  });
};

Ember.config.overridePrototypeMixin = function(PrototypeMixin) {
  PrototypeMixin.reopen({
    destroy: syncForTest()
  });
};

Ember.RSVP.Promise.prototype.then = syncForTest(Ember.RSVP.Promise.prototype.then);

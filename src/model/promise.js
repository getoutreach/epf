/**
  A `ModelPromise` is an object that acts like both an `Ember.Object`
  and a promise. When the promise is resolved the the resulting value
  will be set to the `ModelPromise`'s `content` property. This makes
  it easy to create data bindings with the `ModelPromise` that will
  be updated when the promise resolves.

  For more information see the [Ember.PromiseProxyMixin
  documentation](/api/classes/Ember.PromiseProxyMixin.html).

  Example

  ```javascript
  var promiseObject = DS.ModelPromise.create({
    promise: $.getJSON('/some/remote/data.json')
  });

  promiseObject.get('name'); // null

  promiseObject.then(function() {
    promiseObject.get('name'); // 'Tomster'
  });
  ```

  @class ModelPromise
  @namespace DS
  @extends Ember.ObjectProxy
  @uses Ember.PromiseProxyMixin
*/
var ModelPromise = Ember.ObjectProxy.extend(Ember.PromiseProxyMixin, {

  load: passThroughMethod('load')

});

function passThroughMethod(name, defaultReturn) {
  return function() {
    var content = get(this, 'content');
    if(!content) return defaultReturn;
    return content[name].apply(content, arguments);
  }
}

export default ModelPromise;

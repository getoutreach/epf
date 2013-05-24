/*global jQuery*/

require('./adapter')

var get = Ember.get, set  = Ember.set;

var Node = function(model, dirtyType) {
  this.model = model;
  this.dirtyType = dirtyType;
  this.children = Ember.Set.create();
  this.parents = Ember.Set.create();
};

Node.prototype = {
  addChild: function(childNode) {
    this.children.add(childNode);
    childNode.parents.add(this);
  },

  isRoot: function() {
    return this.parents.every(function(parent) {
      return !get(parent, 'record.isDirty') && parent.isRoot();
    });
  }
};

/**
  The REST adapter allows your store to communicate with an HTTP server by
  transmitting JSON via XHR. Most Ember.js apps that consume a JSON API
  should use the REST adapter.

  This adapter is designed around the idea that the JSON exchanged with
  the server should be conventional.

  ## JSON Structure

  The REST adapter expects the JSON returned from your server to follow
  these conventions.

  ### Object Root

  The JSON payload should be an object that contains the record inside a
  root property. For example, in response to a `GET` request for
  `/posts/1`, the JSON should look like this:

  ```js
  {
    "post": {
      title: "I'm Running to Reform the W3C's Tag",
      author: "Yehuda Katz"
    }
  }
  ```

  ### Conventional Names

  Attribute names in your JSON payload should be the underscored versions of
  the attributes in your Ember.js models.

  For example, if you have a `Person` model:

  ```js
  App.Person = DS.Model.extend({
    firstName: DS.attr('string'),
    lastName: DS.attr('string'),
    occupation: DS.attr('string')
  });
  ```

  The JSON returned should look like this:

  ```js
  {
    "person": {
      "first_name": "Barack",
      "last_name": "Obama",
      "occupation": "President"
    }
  }
  ```

  @class RESTAdapter
  @constructor
  @namespace DS
  @extends DS.Adapter
*/
Orm.RestAdapter = Orm.Adapter.extend({
  init: function() {
    this._super.apply(this, arguments);
  },

  load: function(type, id) {
    var model;
    if(model = this.store.getModel(type, id)) {
      return resolve(model);
    }
    var root = this.rootForType(type), adapter = this;

    return this.ajax(this.buildURL(root, id), "GET").then(function(json){
      //return Ember.run(adapter,'didFindRecord', store, type, json, id);
      // TODO: handle 404s etc
      return adapter.didReceiveDataForLoad(json, type, id);
    });
  },

  refresh: function(model) {
    var type = model.constructor;
    var root = this.rootForType(type), adapter = this;

    return this.ajax(this.buildURL(root, id), "GET").then(function(json){
      //return Ember.run(adapter,'didFindRecord', store, type, json, id);
      // TODO: handle 404s etc
      return adapter.didReceiveData(json, model);
    });
  },

  update: function(model) {
    var id, root, adapter, data, type = model.constructor;

    id = get(model, 'id');
    root = this.rootForType(type);
    adapter = this;

    data = {};
    data[root] = this.serializer.serialize(model);

    return this.ajax(this.buildURL(root, id), "PUT",{
      data: data
    }).then(function(json){
      // TODO: run loop?
      // Ember.run(adapter, 'didUpdate', model, json);
      return adapter.didReceiveData(json, model);
    }, function(xhr) {
      // TODO: think this through
      // adapter.didError(store, type, record, xhr);
      throw xhr;
    });
  },

  create: function(model) {
    var type = model.constructor;
    var root = this.rootForType(type);
    var adapter = this;
    var data = {};

    data[root] = this.serializer.serialize(model, { includeId: true });

    debugger
    return this.ajax(this.buildURL(root), "POST", {
      data: data
    }).then(function(json){
      // TODO: run loop?
      // Ember.run(adapter, 'didCreateRecord', store, type, record, json);
      return adapter.didReceiveData(json, model);
    }, function(xhr) {
      // TODO: think this through
      // adapter.didError(store, type, record, xhr);
      throw xhr;
    });
  },

  deleteModel: function(model) {
    var id, root, adapter, type = model.constructor;

    id = get(model, 'id');
    root = this.rootForType(type);
    adapter = this;

    return this.ajax(this.buildURL(root, id), "DELETE").then(function(json){
      // TODO: run loop?
      // Ember.run(adapter, 'didDeleteRecord', store, type, record, json);
      return adapter.didReceiveData(json, model);
    }, function(xhr){
      // TODO: think this through
      // adapter.didError(store, type, record, xhr);
      throw xhr;
    });
  },

  didReceiveData: function(data, targetModel) {
    var models = this.serializer.deserialize(data);
    var result = null;
    models.forEach(function(model) {
      this.loaded(model);
      if(model.equals(targetModel)) {
        result = model;
      }
    }, this);
    // TODO: what if no data returned?
    return result;
  },

  didReceiveDataForLoad: function(data, type, id) {
    var models = this.serializer.deserialize(data);
    var result = null;
    models.forEach(function(model) {
      this.loaded(model);
      if(model.constructor === type && get(model, 'id') === id) {
        result = model;
      }
    }, this);
    // TODO: what if no data returned?
    return result;
  },

  // TODO
  find: null,

  flush: function(session) {
    var adapter = this;

    var rootNodes = this._createDependencyGraph(session);

    function createNestedPromise(node) {
      var promise;
      if(!node.dirtyType) {
        // return an "identity" promise if we don't want to do anything
        promise = Ember.RSVP.resolve();
      } else if(node.dirtyType === "created") {
        promise = adapter.create(node.model);
      } else if(node.dirtyType === "updated") {
        promise = adapter.update(node.model);
      } else if(node.dirtyType === "deleted") {
        promise = adapter.deleteModel(node.model);
      }
      if(node.children.length > 0) {
        promise = promise.then(function() {
          var childPromises = node.children.map(createNestedPromise);
          return Ember.RSVP.all(childPromises);
        });
      }
      return promise;
    }

    return Ember.RSVP.all(rootNodes.map(createNestedPromise));
  },

  _createDependencyGraph: function(session) {
    var adapter = this;
    var modelToNode = Ember.MapWithDefault.create({
      defaultValue: function(model) {
        return new Node(model, adapter.dirtyType(model));
      }
    });

    // TODO: make diff compute relationship changes and use here

    // commitDetails.relationships.forEach(function(r) {
    //   var childNode = referenceToNode.get(r.childReference);
    //   var parentNode = referenceToNode.get(r.parentReference);

    //   // In the non-embedded case, there is a potential request race
    //   // condition where the parent returns the id of a deleted child.
    //   // To solve for this we make the child delete complete first.
    //   if(r.changeType === 'remove' && adapter.shouldSave(childNode.record) && adapter.shouldSave(parentNode.record)) {
    //     childNode.addChild(parentNode);
    //   } else {
    //     parentNode.addChild(childNode);
    //   }
    // });

    var rootNodes = Ember.Set.create();

    session.get('models').forEach(function(model) {
      var node = modelToNode.get(model);
      //if(node.isRoot()) {
        rootNodes.add(node);
      //}
    }, this);

    return rootNodes;
  },

  isDirtyFromRelationships: function(model, cached, diff) {
    // TODO
    return false;
  },

  dirtyRecordsForHasManyChange: function(dirtySet, record, relationship) {
    var embeddedType = get(this, 'serializer').embeddedType(record.constructor, relationship.secondRecordName);

    if (embeddedType === 'always') {
      relationship.childReference.parent = relationship.parentReference;
      this._dirtyTree(dirtySet, record);
    }
  },

  _dirtyTree: function(dirtySet, record) {
    dirtySet.add(record);

    get(this, 'serializer').eachEmbeddedRecord(record, function(embeddedRecord, embeddedType) {
      if (embeddedType !== 'always') { return; }
      if (dirtySet.has(embeddedRecord)) { return; }
      this._dirtyTree(dirtySet, embeddedRecord);
    }, this);

    var reference = record.get('_reference');

    if (reference.parent) {
      var store = get(record, 'store');
      var parent = store.recordForReference(reference.parent);
      this._dirtyTree(dirtySet, parent);
    }
  },

  ajax: function(url, type, hash) {
    try {
      hash = hash || {};
      hash.url = url;
      hash.type = type;
      hash.dataType = 'json';
      hash.context = this;

      if (hash.data && type !== 'GET') {
        hash.contentType = 'application/json; charset=utf-8';
        hash.data = JSON.stringify(hash.data);
      }

      return Ember.RSVP.resolve(jQuery.ajax(hash));
    } catch (error) {
      return Ember.RSVP.resolve(error);
    }
  },

  url: "",

  rootForType: function(type) {
    var serializer = get(this, 'serializer');
    return serializer.rootForType(type);
  },

  pluralize: function(string) {
    var serializer = get(this, 'serializer');
    return serializer.pluralize(string);
  },

  buildURL: function(record, suffix) {
    var url = [this.url];

    Ember.assert("Namespace URL (" + this.namespace + ") must not start with slash", !this.namespace || this.namespace.toString().charAt(0) !== "/");
    Ember.assert("Record URL (" + record + ") must not start with slash", !record || record.toString().charAt(0) !== "/");
    Ember.assert("URL suffix (" + suffix + ") must not start with slash", !suffix || suffix.toString().charAt(0) !== "/");

    if (!Ember.isNone(this.namespace)) {
      url.push(this.namespace);
    }

    url.push(this.pluralize(record));
    if (suffix !== undefined) {
      url.push(suffix);
    }

    return url.join("/");
  },

  sinceQuery: function(since) {
    var query = {};
    query[get(this, 'since')] = since;
    return since ? query : null;
  }
});

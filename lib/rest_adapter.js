/*global jQuery*/

require('./adapter')

var get = Ember.get, set  = Ember.set;

var Node = function(reference) {
  this.reference = reference;
  this.record = reference.record;
  this.dirtyType = get(this.record, 'dirtyType');
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
    if(var model = store.getModel(type, id)) {
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

    data[root] = this.serializer.serialize(record, { includeId: true });

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
    });
    // TODO: what if no data returned?
    return result;
  },

  didReceiveDataForLoad: function(data, type, id) {
    var models = this.serializer.deserialize(data);
    var result = null;
    models.forEach(function(model) {
      this.loaded(model);
      if(model.constructor === type && get(model, id) === id) {
        result = model;
      }
    });
    // TODO: what if no data returned?
    return result;
  },

  // TODO
  find: null,

  flush: function(session) {

  },

  save: function(store, commitDetails) {
    if(get(this, 'bulkCommit') !== false) {
      return this.saveBulk(store, commitDetails);
    }
    var adapter = this;

    var rootNodes = this._createDependencyGraph(store, commitDetails);

    function createNestedPromise(node) {
      var promise;
      if(!adapter.shouldSave(node.record) || !node.dirtyType) {
        // return an "identity" promise if we don't want to do anything
        promise = Ember.RSVP.resolve();
      } else if(node.dirtyType === "created") {
        promise = adapter.createRecord(store, node.reference.type, node.record);
      } else if(node.dirtyType === "updated") {
        promise = adapter.updateRecord(store, node.reference.type, node.record);
      } else if(node.dirtyType === "deleted") {
        promise = adapter.deleteRecord(store, node.reference.type, node.record);
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

  _createDependencyGraph: function(store, commitDetails) {
    var adapter = this;
    var referenceToNode = Ember.MapWithDefault.create({
      defaultValue: function(reference) {
        return new Node(reference);
      }
    });

    commitDetails.relationships.forEach(function(r) {
      var childNode = referenceToNode.get(r.childReference);
      var parentNode = referenceToNode.get(r.parentReference);

      // In the non-embedded case, there is a potential request race
      // condition where the parent returns the id of a deleted child.
      // To solve for this we make the child delete complete first.
      if(r.changeType === 'remove' && adapter.shouldSave(childNode.record) && adapter.shouldSave(parentNode.record)) {
        childNode.addChild(parentNode);
      } else {
        parentNode.addChild(childNode);
      }
    });

    var rootNodes = Ember.Set.create();
    function filter(record) {
      var node = referenceToNode.get(get(record, '_reference'));
      if(node.isRoot()) {
        rootNodes.add(node);
      }
    }

    commitDetails.created.forEach(filter);
    commitDetails.updated.forEach(filter);
    commitDetails.deleted.forEach(filter);

    return rootNodes;
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

  createRecord: function(store, type, record) {
    var root = this.rootForType(type);
    var adapter = this;
    var data = {};

    data[root] = this.serialize(record, { includeId: true });

    return this.ajax(this.buildURL(root), "POST", {
      data: data
    }).then(function(json){
      Ember.run(adapter, 'didCreateRecord', store, type, record, json);
    }, function(xhr) {
      adapter.didError(store, type, record, xhr);
      throw xhr;
    });
  },

  createRecords: function(store, type, records) {
    var adapter = this;

    if (get(this, 'bulkCommit') === false) {
      return Ember.RSVP.all(records.map(function(record) {
        return this.createRecord(store, type, record);
      }, this));
    }

    var root = this.rootForType(type),
        plural = this.pluralize(root);

    var data = {};
    data[plural] = [];
    records.forEach(function(record) {
      data[plural].push(this.serialize(record, { includeId: true }));
    }, this);

    return this.ajax(this.buildURL(root), "POST", {
      data: data
    }).then(function(json) {
      Ember.run(adapter, 'didCreateRecords', store, type, records, json);
    });
  },

  updateRecord: function(store, type, record) {
    var id, root, adapter, data;

    id = get(record, 'id');
    root = this.rootForType(type);
    adapter = this;

    data = {};
    data[root] = this.serialize(record);

    return this.ajax(this.buildURL(root, id), "PUT",{
      data: data
    }).then(function(json){
      Ember.run(adapter, 'didUpdateRecord', store, type, record, json);
    }, function(xhr) {
      adapter.didError(store, type, record, xhr);
      throw xhr;
    });
  },

  updateRecords: function(store, type, records) {
    var root, plural, adapter, data;

    if (get(this, 'bulkCommit') === false) {
      return Ember.RSVP.all(records.map(function(record) {
        return this.updateRecord(store, type, record);
      }, this));
    }

    root = this.rootForType(type);
    plural = this.pluralize(root);
    adapter = this;

    data = {};

    data[plural] = [];

    records.forEach(function(record) {
      data[plural].push(this.serialize(record, { includeId: true }));
    }, this);

    return this.ajax(this.buildURL(root, "bulk"), "PUT", {
      data: data
    }).then(function(json) {
      Ember.run(adapter, 'didUpdateRecords', store, type, records, json);
    });
  },

  deleteRecord: function(store, type, record) {
    var id, root, adapter;

    id = get(record, 'id');
    root = this.rootForType(type);
    adapter = this;

    return this.ajax(this.buildURL(root, id), "DELETE").then(function(json){
      Ember.run(adapter, 'didDeleteRecord', store, type, record, json);
    }, function(xhr){
      adapter.didError(store, type, record, xhr);
      throw xhr;
    });
  },

  deleteRecords: function(store, type, records) {
    var root, plural, serializer, adapter, data;

    if (get(this, 'bulkCommit') === false) {
      return Ember.RSVP.all(records.map(function(record) {
        return this.deleteRecord(store, type, record);
      }, this));
    }

    root = this.rootForType(type),
    plural = this.pluralize(root),
    serializer = get(this, 'serializer'),
    adapter = this;

    data = {};

    data[plural] = [];
    records.forEach(function(record) {
      data[plural].push(serializer.serializeId( get(record, 'id') ));
    });

    return this.ajax(this.buildURL(root, 'bulk'), "DELETE", { data: data }).then(function(json){
      Ember.run(adapter, 'didDeleteRecords', store, type, records, json);
    });
  },

  find: function(store, type, id) {
    var root = this.rootForType(type), adapter = this;

    return this.ajax(this.buildURL(root, id), "GET").then(function(json){
      return Ember.run(adapter,'didFindRecord', store, type, json, id);
    });
  },

  findAll: function(store, type, since) {
    var root, adapter;

    root = this.rootForType(type);
    adapter = this;

    return this.ajax(this.buildURL(root), "GET",{
      data: this.sinceQuery(since)
    }).then(function(json) {
      Ember.run(adapter,'didFindAll', store, type, json);
    });
  },

  findQuery: function(store, type, query, recordArray) {
    var root = this.rootForType(type),
    adapter = this;

    return this.ajax(this.buildURL(root), "GET", {
      data: query
    }).then(function(json){
      Ember.run(adapter, function(){
        this.didFindQuery(store, type, json, recordArray);
      });
    });
  },

  findMany: function(store, type, ids, owner) {
    var root = this.rootForType(type),
    adapter = this;

    ids = this.serializeIds(ids);

    return this.ajax(this.buildURL(root), "GET", {
      data: {ids: ids}
    }).then(function(json) {
      return Ember.run(adapter,'didFindMany', store, type, json);
    });
  },

  /**
    @private

    This method serializes a list of IDs using `serializeId`

    @returns {Array} an array of serialized IDs
  */
  serializeIds: function(ids) {
    var serializer = get(this, 'serializer');

    return Ember.EnumerableUtils.map(ids, function(id) {
      return serializer.serializeId(id);
    });
  },

  didError: function(store, type, record, xhr) {
    if (xhr.status === 422) {
      var json = JSON.parse(xhr.responseText),
          serializer = get(this, 'serializer'),
          errors = serializer.extractValidationErrors(type, json);

      store.recordWasInvalid(record, errors);
    } else {
      this._super.apply(this, arguments);
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

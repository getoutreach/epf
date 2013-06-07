describe "rest", ->

  adapter = null
  session = null

  beforeEach ->
    require('./_shared').setupRest.apply(this)
    adapter = @adapter
    session = @session

  describe "managing groups with embedded members", ->

    beforeEach ->
      Ep.__container__ = @container
      class @Group extends Ep.Model
        name: Ep.attr('string')
      @App.Group = @Group

      class @Member extends Ep.Model
        role: Ep.attr('string')
        group: Ep.belongsTo(@Group)
      @App.Member = @Member

      class @User extends Ep.Model
        name: Ep.attr('string')
        groups: Ep.hasMany(@Group)
        members: Ep.hasMany(@Member)
      @App.User = @User

      @Group.reopen
        members: Ep.hasMany(@Member)
        user: Ep.belongsTo(@User)

      @Member.reopen
        user: Ep.belongsTo(@User)


      @container.register 'model:group', @Group, instantiate: false
      @container.register 'model:member', @Member, instantiate: false
      @container.register 'model:user', @User, instantiate: false

      @RestAdapter.map @Group,
        members: { embedded: 'always' }
      # Re-instantiate since mappings are reified
      @adapter = @container.lookup('adapter:main')
      adapter = @adapter
      session = adapter.newSession()

    afterEach ->
      delete Ep.__container__

    it 'creates new group and then deletes a member', ->
      adapter.r['POST:/users'] = -> users: {client_id: user.clientId, id: "1", name: "wes"}
      adapter.r['POST:/groups'] = -> groups: {client_id: group.clientId, id: "2", name: "brogrammers", members: [{client_id: member.clientId, id: "3", role: "chief", post_id: "2"}], user_id: "1"}

      child = session.newSession()
      user = child.create 'user', name: 'wes'
      group = null
      member = null
      child.flush().then ->
        expect(user.id).to.not.be.null
        expect(adapter.h).to.eql(['POST:/users'])
        child = session.newSession()
        user = child.add(user)
        group = child.create 'group', name: 'brogrammers', user: user
        member = child.create 'member', role: 'chief', user: user, group: group
        child.flush().then ->
          expect(adapter.h).to.eql(['POST:/users', 'POST:/groups'])
          expect(user.id).to.not.be.null
          expect(group.id).to.not.be.null
          expect(member.id).to.not.be.null

          child = session.newSession()
          member = child.add(member);
          child.deleteModel(member);

          adapter.r['PUT:/groups/2'] = -> groups: {client_id: group.clientId, id: "2", name: "brogrammers", members: [], user_id: "1"}
          child.flush().then ->
            expect(member.get('isDeleted')).to.be.true
            expect(adapter.h).to.eql(['POST:/users', 'POST:/groups', 'PUT:/groups/2'])





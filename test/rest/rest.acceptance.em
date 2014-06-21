describe "rest", ->

  adapter = null
  session = null

  beforeEach ->
    require('./_shared').setupRest.apply(this)
    adapter = @adapter
    session = @session
    Ep.__container__ = @container

  afterEach ->
    delete Ep.__container__

  describe "managing groups with embedded members", ->

    beforeEach ->
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


      @container.register 'model:group', @Group
      @container.register 'model:member', @Member
      @container.register 'model:user', @User

      GroupSerializer = Ep.ModelSerializer.extend
        properties:
          members:
            embedded: 'always'

      @container.register 'serializer:group', GroupSerializer

    it 'creates new group and then deletes a member', ->
      adapter.r['POST:/users'] = -> users: {client_id: user.clientId, id: 1, name: "wes"}
      adapter.r['POST:/groups'] = (url, type, hash) ->
        expect(hash.data.group.members[0].role).to.eq('chief')
        return groups: {client_id: group.clientId, id: 2, name: "brogrammers", members: [{client_id: member.clientId, id: 3, role: "chief", group: 2, user: 1}], user: 1}

      childSession = session.newSession()
      user = childSession.create 'user', name: 'wes'
      group = null
      member = null
      childSession.flushIntoParent().then ->
        expect(user.id).to.not.be.null
        expect(adapter.h).to.eql(['POST:/users'])
        childSession = session.newSession()
        user = childSession.add(user)
        group = childSession.create 'group', name: 'brogrammers', user: user
        member = childSession.create 'member', role: 'chief', user: user, group: group
        childSession.flushIntoParent().then ->
          expect(adapter.h).to.eql(['POST:/users', 'POST:/groups'])
          expect(user.id).to.not.be.null
          expect(group.id).to.not.be.null
          expect(group.members.length).to.eq(1)
          expect(user.groups.length).to.eq(1)
          expect(user.members.length).to.eq(1)
          expect(member.id).to.not.be.null

          childSession = session.newSession()
          member = childSession.add(member)
          user = childSession.add(user)
          group = childSession.add(group)
          childSession.deleteModel(member)
          expect(user.members.length).to.eq(0)
          expect(group.members.length).to.eq(0)
          expect(user.groups.length).to.eq(1)

          adapter.r['PUT:/groups/2'] = -> groups: {client_id: group.clientId, id: 2, name: "brogrammers", members: [], user: 1}
          childSession.flushIntoParent().then ->
            expect(member.get('isDeleted')).to.be.true
            expect(group.members.length).to.eq(0)
            expect(user.members.length).to.eq(0)
            expect(user.groups.length).to.eq(1)
            expect(adapter.h).to.eql(['POST:/users', 'POST:/groups', 'PUT:/groups/2'])


    it "doesn't choke when loading a group without a members key", ->
      adapter.r['GET:/groups'] = groups: [{client_id: null, id: "1", name: "brogrammers", user: "1"}]

      session.query("group").then (result) ->
        expect(adapter.h).to.eql(['GET:/groups'])
        expect(result.length).to.eq(1)
        expect(result.firstObject.name).to.eq("brogrammers")
        expect(result.firstObject.groups).to.be.undefined


    it 'adds a member to an existing group', ->
      adapter.r['GET:/groups/1'] = -> groups: {id: 1, name: "employees", members: [{id: 2, name: "kinz", group: 1, user: 3}]}, users: {id: 3, name: "wtf", members: [2], groups: [1]}

      session.load("group", 1).then (group) ->
        expect(adapter.h).to.eql(['GET:/groups/1'])

        childSession = session.newSession()
        childGroup = childSession.add(group)

        existingMember = childGroup.members.firstObject
        expect(existingMember.user).to.not.be.null
        expect(existingMember.user.isDetached).to.be.false

        member = childSession.create('member', {name: "mollie"})
        childGroup.members.addObject(member)

        expect(childGroup.members.length).to.eq(2)
        expect(group.members.length).to.eq(1)

        adapter.r['PUT:/groups/1'] = -> groups: {id: 1, name: "employees", members: [{id: 2, name: "kinz", group: 1}, {id: 3, client_id: member.clientId, name: "mollie", group: 1}]}
        promise = childSession.flushIntoParent().then ->
          expect(childGroup.members.length).to.eq(2)
          expect(group.members.length).to.eq(2)
          expect(adapter.h).to.eql(['GET:/groups/1', 'PUT:/groups/1'])

        expect(group.members.length).to.eq(2)
        promise


  describe "managing comments", ->

    beforeEach ->
      class @Post extends Ep.Model
        title: Ep.attr('string')
      @App.Post = @Post

      class @Comment extends Ep.Model
        message: Ep.attr('string')
        post: Ep.belongsTo(@Post)
      @App.Comment = @Comment

      @Post.reopen
        comments: Ep.hasMany(@Comment)

      @container.register 'model:post', @Post
      @container.register 'model:comment', @Comment


    it 'creates a new comment within a child session', ->
      adapter.r['POST:/comments'] = -> comment: {client_id: comment.clientId, id: "3", message: "#2", post: "1"}

      post = session.merge @Post.create(id: "1", title: "brogrammer's guide to beer pong")
      session.merge @Comment.create(id: "2", message: "yo", post: post)

      childSession = session.newSession()
      childPost = childSession.add(post)
      comment = childSession.create 'comment',
        message: '#2',
        post: childPost

      expect(childPost.comments.length).to.eq(2)

      promise = childSession.flushIntoParent().then ->
        expect(childPost.comments.length).to.eq(2)
        expect(post.comments.length).to.eq(2)

      expect(childPost.comments.length).to.eq(2)
      expect(post.comments.length).to.eq(2)
      promise


  describe "two levels of embedded", ->

    beforeEach ->
      class @User extends Ep.Model
        name: Ep.attr('string')
        profile: Ep.belongsTo('profile')
      @App.User = @User

      class @Profile extends Ep.Model
        bio: Ep.attr('string')
        user: Ep.belongsTo('user')
        tags: Ep.hasMany('tag')
      @App.Profile = @Profile

      class @Tag extends Ep.Model
        name: Ep.attr('string')
        profile: Ep.belongsTo('profile')
      @App.Tag = @Tag


      @container.register 'model:user', @User
      @container.register 'model:profile', @Profile
      @container.register 'model:tag', @Tag

      UserSerializer = Ep.ModelSerializer.extend
        properties:
          profile:
            embedded: 'always'

      @container.register 'serializer:user', UserSerializer

      ProfileSerializer = Ep.ModelSerializer.extend
        properties:
          tags:
            embedded: 'always'

      @container.register 'serializer:profile', ProfileSerializer

    it 'deletes root', ->
      adapter.r['DELETE:/users/1'] = {}

      @User.create id: '1'
      user = session.merge @User.create
        id: '1'
        name: 'abby'
        profile: @Profile.create
          id: '2'
          bio: 'asd'
          tags: [@Tag.create(id: '3', name: 'java')]

      session.deleteModel(user)
      session.flush().then ->
        expect(adapter.h).to.eql(['DELETE:/users/1'])
        expect(user.isDeleted).to.be.true

  describe 'multiple belongsTo', ->
    beforeEach ->
      class @Foo extends Ep.Model
      @App.Foo = @Foo
      class @Bar extends Ep.Model
      @App.Bar = @Bar
      class @Baz extends Ep.Model
      @App.Baz = @Baz

      @Foo.reopen
        bar: Ep.belongsTo @Bar
        baz: Ep.belongsTo @Baz

      @Bar.reopen
        foos: Ep.hasMany @Foo

      @Baz.reopen
        foos: Ep.hasMany @Foo

      @container.register 'model:foo', @Foo
      @container.register 'model:bar', @Bar
      @container.register 'model:baz', @Baz

    it 'sets ids properly', ->
      adapter.r['POST:/bars'] = -> bar: {client_id: bar.clientId, id: "1"}
      adapter.r['POST:/bazs'] = -> baz: {client_id: baz.clientId, id: "1"}
      adapter.r['POST:/foos'] = (url, type, hash) ->
        expect(hash.data.foo.bar).to.eq 1
        expect(hash.data.foo.baz).to.eq 1
        foo: {client_id: foo.clientId, id: "1", bar: "1", baz: "1"}

      childSession = session.newSession()
      foo = childSession.create 'foo'
      bar = childSession.create 'bar'
      baz = childSession.create 'baz'
      foo.set 'bar', bar
      foo.set 'baz', baz
      childSession.flushIntoParent().then ->
        expect(adapter.h).to.eql ['POST:/bars', 'POST:/bazs', 'POST:/foos']
        expect(foo.id).to.not.be.null
        expect(bar.id).to.not.be.null
        expect(baz.id).to.not.be.null
        expect(foo.bar).to.not.be.null
        expect(foo.baz).to.not.be.null
        expect(bar.foos.length).to.eq 1
        expect(baz.foos.length).to.eq 1


  describe 'deep embedded relationship with leaf referencing a model without an inverse', ->

    beforeEach ->
      class @Template extends Ep.Model
        subject: Ep.attr 'string'
      @App.Template = @Template

      class @Campaign extends Ep.Model
        campaignSteps: Ep.hasMany 'campaign_step'
      @App.Campaign = @Campaign

      class @CampaignStep extends Ep.Model
        campaign: Ep.belongsTo 'campaign'
        campaignTemplates: Ep.hasMany 'campaign_template'
      @App.CampaignStep = @CampaignStep

      class @CampaignTemplate extends Ep.Model
        campaignStep: Ep.belongsTo 'campaign_step'
        template: Ep.belongsTo 'template'
      @App.CampaignTemplate = @CampaignTemplate

      @container.register 'model:template', @Template
      @container.register 'model:campaign', @Campaign
      @container.register 'model:campaign_template', @CampaignTemplate
      @container.register 'model:campaign_step', @CampaignStep

      CampaignSerializer = Ep.ModelSerializer.extend
        properties:
          campaignSteps:
            embedded: 'always'

      CampaignStepSerializer = Ep.ModelSerializer.extend
        properties:
          campaignTemplates:
            embedded: 'always'

      @container.register 'serializer:campaign', CampaignSerializer
      @container.register 'serializer:campaign_step', CampaignStepSerializer


    it 'creates new embedded child with reference to new hasMany', ->
      adapter.r['POST:/templates'] = -> templates: {client_id: template.clientId, id: 2, subject: 'topological sort'}
      adapter.r['PUT:/campaigns/1'] = (url, type, hash) ->
        expect(hash.data.campaign.campaign_steps[0].campaign_templates[0].template).to.eq(2)
        return campaigns:
          id: 1
          client_id: campaign.clientId
          campaign_steps: [
            client_id: campaignStep.clientId
            id: 3
            campaign_templates: [
              {id: 4, client_id: campaignTemplate.clientId, template: 2, campaign_step: 3}
            ]
          ]

      campaign = session.merge @session.build('campaign', id: 1)

      session = session.newSession()
      campaign = session.add campaign
      campaignStep = session.create('campaign_step', campaign: campaign)

      campaignTemplate = session.create 'campaign_template'
      campaignStep.campaignTemplates.pushObject(campaignTemplate)

      template = session.create 'template'
      template.subject = 'topological sort'

      campaignTemplate.template = template

      session.flush().then ->
        expect(template.id).to.not.be.null
        expect(template.isNew).to.be.false
        expect(template.subject).to.eq('topological sort')
        expect(campaignTemplate.id).to.not.be.null
        expect(campaignTemplate.template).to.eq(template)
        expect(campaignTemplate.template.id).to.eq("2")
        expect(adapter.h).to.eql(['POST:/templates', 'PUT:/campaigns/1'])
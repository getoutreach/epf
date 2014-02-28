describe "Ep.ActiveModelAdapter", ->

  adapter = null
  session = null

  beforeEach ->
    require('./_shared').setup.apply(this)
    adapter = @adapter
    session = @session
    Ep.__container__ = @container

    class @MessageThread extends Ep.Model
      subject: Ep.attr('string')
    @App.MessageThread = @MessageThread
    @container.register 'model:message_thread', @MessageThread

  afterEach ->
    delete Ep.__container__

  describe '.pathForType', ->

    it 'underscores and pluralizes', ->
      expect(adapter.pathForType('message_thread')).to.eq('message_threads')




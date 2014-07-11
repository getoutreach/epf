`import setup from './_shared'`

describe "Ep.ActiveModelAdapter", ->

  adapter = null
  session = null

  beforeEach ->
    setup.apply(this)
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




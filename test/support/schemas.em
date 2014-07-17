`import Model from 'epf/model/model'`
`import attr from 'epf/model/attribute'`

postSchema = ->
  class @Post extends Model
    title: attr('string')

`export {postSchema}`
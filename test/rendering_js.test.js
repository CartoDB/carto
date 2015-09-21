
var assert = require('assert');
var carto = require('../lib/carto');
var tree = require('../lib/carto/tree');
var _ = require('underscore');

describe('RenderingJS', function() {
  var shader;
  var style = [
  '#world {', 
    'line-width: 2;', 
    'line-color: #f00;', 
    '[frame-offset = 1] {', 
      'line-width: 3;', 
    '}', 
    '[frame-offset = 2] {', 
      'line-width: 3;', 
    '}', 
  '}', 
  '', 
  '#worls[frame-offset = 10] {', 
      'line-width: 4;', 
  '}'
  ].join('\n');

  beforeEach(function(done) {
    (new carto.RendererJS({ debug: true })).render(style, function (err, s) {
      shader = s;
      done();
    });
  });

  it("shold render layers", function() {
    assert(shader.getLayers().length === 2);
  });

  it("shold report frames used in the layer", function() {
    var layer = shader.getLayers()[0];
    assert(layer.frames()[0] === 0);
    assert(layer.frames()[1] === 1);

    layer = shader.getLayers()[1];
    assert(layer.frames()[0] === 10);
  });

  it ("shold render with frames var", function() {
    var layer = shader.getLayers()[1];
    var props = layer.getStyle({}, { 'zoom': 0, 'frame-offset': 10 });
    assert( props['line-width'] === 4);
  });

  it("shold render variables", function(done) {
    var style = '#test { marker-width: [testing]; }';
    (new carto.RendererJS({ debug: true })).render(style, function(err, s) {
      console.log("#### --> ", s);
      debugger
      var layer = s.getLayers()[0];
      var props = layer.getStyle({testing: 2}, { 'zoom': 0, 'frame-offset': 10 });
      assert( props['marker-width'] === 2);
      done();
    });
  });

  it ("should allow filter based rendering", function(done) {
    var style = '#test { marker-width: 10; [zoom = 1] { marker-width: 1; } }';
    (new carto.RendererJS({ debug: true })).render(style, function(err, shader) {
      var layer = shader.getLayers()[0];
      var props = layer.getStyle({}, { 'zoom': 0, 'frame-offset': 10 });
      assert( props['marker-width'] ===  10);
      props = layer.getStyle({}, { 'zoom': 1, 'frame-offset': 10 });
      assert( props['marker-width'] ===  1);
      done();
    });
  });

  it ("symbolizers should be in rendering order", function(done) {
    var style = '#test { polygon-fill: red; line-color: red; }';
    style += '#test2 { line-color: red;polygon-fill: red; line-witdh: 10; }';
    (new carto.RendererJS({ debug: true })).render(style, function(err, shader) {
      var layer0 = shader.getLayers()[0];
      assert(layer0.getSymbolizers()[0] === 'polygon');
      assert(layer0.getSymbolizers()[1] === 'line');

      var layer1 = shader.getLayers()[1];
      assert(layer0.getSymbolizers()[0] === 'polygon');
      assert(layer0.getSymbolizers()[1] === 'line');
      done();
    });
  });

  it ("colorize should return a list of colours in same order", function(done) {
    var style = '#test { image-filters: colorize-alpha(blue, cyan, green, yellow, orange, red); }';
    (new carto.RendererJS({ debug: true })).render(style, function(err, shader) {
      var layer0 = shader.getLayers()[0];
      var st = layer0.getStyle({ value: 1 }, {"frame-offset": 0, "zoom": 3});
      var expectedColours = [[0, 0, 255], [0, 255, 255], [0, 128, 0], [255, 255, 0], [255, 165, 0], [255, 0, 0]];
      for (var i = 0; i < st["image-filters"].args; i++){
        assert (st["image-filters"].args[i].rgb === expectedColours[i]);
      }
      done();
    });
  });

  it ("should return list of marker-files", function(done) {
    var css = [
          'Map {',
          '-torque-time-attribute: "date";',
          '-torque-aggregation-function: "count(cartodb_id)";',
          '-torque-frame-count: 760;',
          '-torque-animation-duration: 15;',
          '-torque-resolution: 2',
          '}',
          '#layer {',
          '  marker-width: 3;',
          '  marker-fill-opacity: 0.8;',
          '  marker-fill: #FEE391; ',
          '  marker-file: url(http://localhost:8081/gal.svg); ',
          '  comp-op: "lighten";',
          '  [value > 2] { marker-file: url(http://upload.wikimedia.org/wikipedia/commons/4/43/Flag_of_the_Galactic_Empire.svg); }',
          '  [value > 3] { marker-file: url(http://upload.wikimedia.org/wikipedia/commons/c/c9/Flag_of_Syldavia.svg); }',
          '  [frame-offset = 1] { marker-width: 10; marker-fill-opacity: 0.05;}',
          '  [frame-offset = 2] { marker-width: 15; marker-fill-opacity: 0.02;}',
          '}'
      ].join('\n');
      (new carto.RendererJS({ debug: true })).render(style, function(err, shader) {
        var markerURLs = shader.getImageURLs();
        var against = ["http://localhost:8081/gal.svg", "http://upload.wikimedia.org/wikipedia/commons/4/43/Flag_of_the_Galactic_Empire.svg", "http://upload.wikimedia.org/wikipedia/commons/c/c9/Flag_of_Syldavia.svg"];
        for(var i = 0; i< against.length; i++){
          assert(against[i] == markerURLs[i])
        }
        done();
      });
  })

  describe("isVariable", function() {

    it("prop", function(done) {
      var style = '#test { marker-width: [prop]; }';
      (new carto.RendererJS({ debug: true })).render(style, function(err, shader) {
        var layer0 = shader.getLayers()[0];
        assert(layer0.isVariable());
        done();
      });
    });

    it ("constant", function(done) {
      style = '#test { marker-width: 1; }';
      (new carto.RendererJS({ debug: true })).render(style, function(err, shader) {
        layer0 = shader.getLayers()[0];
        assert(!layer0.isVariable());
        done();
      });
    });

    it ("both", function(done) {
      style = '#test { marker-width: [prop]; marker-fill: red;  }';
      (new carto.RendererJS({ debug: true })).render(style, function(err, shader) {
        layer0 = shader.getLayers()[0];
        assert(layer0.isVariable());
        done();
      });
    });
  });

  it ("should be able to provide external functions", function(done) {
    var style = '#test { marker-width: testing([prop]); }';
    var renderer = new carto.RendererJS({ debug: true })
    renderer.addFunction('testing', function(args, callback) {
      _.defer(function() {
        callback(function(a) {
          return {
            is: 'custom',
            toString: function() {
              return "(function() { return data['" + a.value + "']})();";
            }
          }
        })
      });
    })
    renderer.render(style, function(err, shader) {
      var layer = shader.getLayers()[0];
      var props = layer.getStyle({prop: 1}, { 'zoom': 0, 'frame-offset': 10 });
      assert(props['marker-width'] === 1);
      done();
    });
  });

  it("should be able to provide do var to var comparasions", function(done) {
    var style = '#test { marker-width: 1; [prop = test.a] {marker-width: 10 }}';
    (new carto.RendererJS({ debug: true })).render(style, function(err, shader) {
      var layer = shader.getLayers()[0];
      var props = layer.getStyle({ prop: 1, test: {a: 1} }, { 'zoom': 0, 'frame-offset': 10 });
      assert(props['marker-width'] === 10);
      var props = layer.getStyle({prop: 1, test: {a: 0}}, { 'zoom': 0, 'frame-offset': 10 });
      assert(props['marker-width'] === 1);
      done();
    });
  });

});

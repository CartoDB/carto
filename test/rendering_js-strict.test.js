var assert = require('assert');
var carto = require('../lib/carto');
var tree = require('../lib/carto/tree');

describe('RendererJS Strict Mode', function() {

  var style = [
    '#world {',
      'polygon-fill: red;',
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

  var reference = {
    version: '1.0.0',
    style: {},
    layer: {},
    colors: {},
    filter: {},
    symbolizers: {
      line: {
        "stroke": {
              "css": "line-color",
              "default-value": "rgba(0,0,0,1)",
              "type": "color",
              "default-meaning": "black and fully opaque (alpha = 1), same as rgb(0,0,0)",
              "doc": "The color of a drawn line"
          },
          "stroke-width": {
              "css": "line-width",
              "default-value": 1,
              "type": "float",
              "doc": "The width of a line in pixels"
          },
          "stroke-opacity": {
              "css": "line-opacity",
              "default-value": 1,
              "type": "float",
              "default-meaning": "opaque",
              "doc": "The opacity of a line"
          },
          "stroke-linejoin": {
              "css": "line-join",
              "default-value": "miter",
              "type": [
                  "miter",
                  "miter-revert",
                  "round",
                  "bevel"
              ],
              "expression": true,
              "doc": "The behavior of lines when joining.",
              "default-meaning": "The line joins will be rendered using a miter look."
          },
          "stroke-linecap": {
              "css": "line-cap",
              "default-value": "butt",
              "type": [
                  "butt",
                  "round",
                  "square"
              ],
              "expression": true,
              "doc": "The display of line endings.",
              "default-meaning": "The line endings will be rendered using a butt look."
          },
          "comp-op": {
              "css": "line-comp-op",
              "default-value": "overlay",
              "default-meaning": "Add the current symbolizer on top of other symbolizer.",
              "doc": "Composite operation. This defines how this symbolizer should behave relative to symbolizers atop or below it.",
              "type": [
                  "multiply",
                  "add",
                  "overlay"
              ],
              "expression": true
          },
          "stroke-dasharray": {
              "css": "line-dasharray",
              "type": "numbers",
              "expression": true,
              "doc": "A pair of length values [a,b], where (a) is the dash length and (b) is the gap length respectively. More than two values are supported for more complex patterns.",
              "default-value": "none",
              "default-meaning": "The line will be drawn without dashes."
          }
      }
    }
  };

  var expectedErrorMessageRegex = /Unrecognized rule: polygon-fill/;

  before(function() {
    this.referenceData = tree.Reference.data;
  });

  after(function() {
    if (this.referenceData) {
      tree.Reference.setData(this.referenceData);
    }
  });

  it('should fail if a feature is not supported and strict is turned on', function () {
    assert.throws(
      function () {
        var RendererJS = new carto.RendererJS({reference: reference, mapnik_version: '1.0.0', strict: true });
        var shader = RendererJS.render(style);
      },
      expectedErrorMessageRegex
    );
  });

  function rendererStrictModeOffTest(RendererJS) {
    return function () {
      var shader = RendererJS.render(style);

      assert.ok(shader.layers);
      assert.equal(shader.layers.length, 2);
    };
  }

  it('should pass if a feature is not supported but strict mode is not specified', rendererStrictModeOffTest(
    new carto.RendererJS({reference: reference, mapnik_version: '1.0.0' })
  ));

  it('should pass if a feature is not supported but strict is turned off', rendererStrictModeOffTest(
    new carto.RendererJS({reference: reference, mapnik_version: '1.0.0', strict: false })
  ));

  it('should pass if a feature is supported and strict is turned on', function () {
    var RendererJS = new carto.RendererJS({reference: reference, mapnik_version: '1.0.0', strict: true });
    var cartocss = '#layer { line-width: 10 }';
    var shader = RendererJS.render(cartocss);
    assert.ok(shader);
  });

});

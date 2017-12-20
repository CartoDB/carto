/**
 * Test the filtered field.
 * 
 * When compiled, a rule provides metainformation fields like index, constant...etc
 * one of this fields is the "filtered field".
 * 
 * This field gives information about whether a property is filtered or not.
 * 
 * A property is filtered if it was activated inside a filter. In the following cartocss
 * code marker-color.filtered will be true because it's inside a population filter.
 * 
 * #layer {
 *   maker-width: 20;
 *   [population > 100] {
 *     marker-color: red; // this property is filtered
 *   }
 * }
 * 
 * "zoom" is a special case, and it only should be considered when its value is not the default.
 */
var assert = require('assert');
var Carto = require('../lib/carto/index.js');
var renderer = new Carto.RendererJS({ strict: true });

describe('property.filtered', function () {
    it('should be false when the property is not filtered', function () {
        var style = [
            '#layer {',
            '  marker-fill: red;',
            '}'
        ].join('\n');
        var layers = renderer.render(style).layers[0].shader;
        assert(!layers['marker-fill'].filtered);
    });

    it('should be true when the property is filtered', function () {
        var style = [
            '#layer {',
            '  [foo > 30] {',
            '    marker-fill: red;',
            '  }',
            '}'
        ].join('\n');

        var layers = renderer.render(style).layers[0].shader;
        assert(layers['marker-fill'].filtered);
    });

    it('should be true when the property is filtered at first level', function () {
        var style = [
            '#layer [foo > 30] {',
            '  marker-fill: red;',
            '}`'
        ].join('\n');

        var layers = renderer.render(style).layers[0].shader;
        assert(layers['marker-fill'].filtered);
    });

    it('should be false when the property is not filterd but there is another filtered properties', function () {
        var style = [
            '#layer {',
            '   marker-fill: red;',
            '   [bar < 200]{',
            '       marker-allow-overlap: false;',
            '    }',
            '}`'
        ].join('\n');

        var layers = renderer.render(style).layers[0].shader;

        assert(!layers['marker-fill'].filtered);
        assert(layers['marker-allow-overlap'].filtered);
    });

    it('should be true when the property is filtered and have a default value', function () {
        var style = [
            '#layer {',
            '   marker-fill: red;',
            '   [bar < 200]{',
            '       marker-fill: blue;',
            '    }',
            '}`'
        ].join('\n');
        var layers = renderer.render(style).layers[0].shader;

        assert(layers['marker-fill'].filtered);
    });

    it('should be true when filtering by zoom', function () {
        var style = [
            '#layer {',
            '   [zoom < 5]{',
            '       marker-fill: blue;',
            '    }',
            '}`'
        ].join('\n');
        var layers = renderer.render(style).layers[0].shader;

        assert(layers['marker-fill'].filtered);
    });
});
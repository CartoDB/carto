var ref = require('./reference.json');
var carto = require('../../lib/carto/index.js');


var ccss = new carto.RendererJS({
    reference: ref,
    strict: true
}).render("#layer { polygon-fill: #abcdef; }");

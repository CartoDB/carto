(function(carto) {
var tree = require('./tree');
var _ = global._ || require('underscore');
var async = require('async');


function CartoCSS(options) {
  this.options = options || {};
  this.imageURLs = [];
}

CartoCSS.Layer = function(shader, options) {
  this.options = options;
  this.shader = shader;
};


CartoCSS.Layer.prototype = {

  fullName: function() {
    return this.shader.attachment;
  },

  name: function() {
    return this.fullName().split('::')[0];
  },

  // frames this layer need to be rendered
  frames: function() {
    return this.shader.frames;
  },

  attachment: function() {
    return this.fullName().split('::')[1];
  },

  eval: function(prop) {
    var p = this.shader[prop];
    if (!p || !p.style) return;
    return p.style({}, { zoom: 0, 'frame-offset': 0 });
  },

  /*
   * `props`: feature properties
   * `context`: rendering properties, i.e zoom
   */
  getStyle: function(props, context) {
    var style = {};
    for(var i in this.shader) {
      if(i !== 'attachment' && i !== 'zoom' && i !== 'frames' && i !== 'symbolizers') {
        style[i] = this.shader[i].style(props, context);
      }
    }
    return style;
  },

  /**
   * return the symbolizers that need to be rendered with 
   * this style. The order is the rendering order.
   * @returns a list with 3 possible values 'line', 'marker', 'polygon'
   */
  getSymbolizers: function() {
    return this.shader.symbolizers;
  },

  /**
   * returns if the style varies with some feature property.
   * Useful to optimize rendering
   */
  isVariable: function() {
    for(var i in this.shader) {
      if(i !== 'attachment' && i !== 'zoom' && i !== 'frames' && i !== 'symbolizers') {
        if (!this.shader[i].constant) {
          return true;
        }
      }
    }
    return false;
  },

  getShader: function() {
    return this.shader;
  },

  /**
   * returns true if a feature needs to be rendered
   */
  filter: function(featureType, props, context) {
    for(var i in this.shader) {
     var s = this.shader[i](props, context);
     if(s) {
       return true;
     }
    }
    return false;
  },

  //
  // given a geoemtry type returns the transformed one acording the CartoCSS
  // For points there are two kind of types: point and sprite, the first one 
  // is a circle, second one is an image sprite
  //
  // the other geometry types are the same than geojson (polygon, linestring...)
  //
  transformGeometry: function(type) {
    return type;
  },

  transformGeometries: function(geojson) {
    return geojson;
  }

};

CartoCSS.parse = function(style, options) {
  var args = Array.prototype.slice.call(arguments);
  var callback = args[args.length - 1];
  // TODO: raise an error if not a function
  var cartocss = new CartoCSS(options);
  cartocss._functions = options.functions;
  cartocss._parse(style, function(err, layers) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, cartocss);
  });

};

CartoCSS.prototype = {

  /*setStyle: function(style) {
    var layers = this.parse(style);
    if(!layers) {
      throw new Error(this.parse_env.errors);
    }
    this.layers = layers.map(function(shader) {
        return new CartoCSS.Layer(shader);
    });
  },*/

  getLayers: function() {
    return this.layers;
  },

  getDefault: function() {
    return this.findLayer({ attachment: '__default__' });
  },

  findLayer: function(where) {
    return _.find(this.layers, function(value) {
      for (var key in where) {
        var v = value[key];
        if (typeof(v) === 'function') {
          v = v.call(value);
        }
        if (where[key] !== v) return false;
      }
      return true;
    });
  },

  _createFn: function(ops) {
    var body = ops.join('\n');
    if(this.options.debug) console.log(body);
    return Function("data","ctx", "var _value = null; " +  body + "; return _value; ");
  },

  _compile: function(shader) {
    if(typeof shader === 'string') {
        shader = eval("(function() { return " + shader +"; })()");
    }
    this.shader_src = shader;
    for(var attr in shader) {
        var c = mapper[attr];
        if(c) {
            this.compiled[c] = eval("(function() { return shader[attr]; })();");
        }
    }
  },
  getImageURLs: function(){
    return this.imageURLs;
  },

  preprocess: function(def, done) {
    var self = this;
    var functions = []
    // look for functions that need preprocess
    _.each(def.rules, function(rule) {
    if (rule.value.value[0] instanceof tree.Expression &&
        rule.value.value[0].value[0] instanceof tree.Call) {
      var call = rule.value.value[0].value[0];
      var fn = self._functions[call.name];
      if (fn) {
        functions.push({
          fn: fn,
          callNode: call
        });
      }
    }
    })
    if (functions.length === 0) {
      done(null, this);
      return;
    }
    // call all of them
    // TODO: we should check for uniqueness to avoid extra calls
    var finished = _.after(functions.length, done.bind(this))
    _.each(functions, function(f) {
      f.fn(f.callNode.args, function(finalFunction) {
        tree.functions[f.callNode.name] = finalFunction;
        finished(null);
      });
    });
  },


  _parse: function(cartocss, callback) {
    var self = this;
    var parse_env = {
      frames: [],
      errors: [],
      error: function(obj) {
        this.errors.push(obj);
      }
    };
    this.parse_env = parse_env;

    var ruleset = null;
    try {
      ruleset = (new carto.Parser(parse_env)).parse(cartocss);
    } catch(e) {
      // add the style.mss string to match the response from the server
      parse_env.errors.push(e.message);
      callback(parse_env);
      return;
    }
    if (ruleset) {
      function defKey(def) {
        return def.elements[0] + "::" + def.attachment;
      }
      var defs = ruleset.toList(parse_env);
      defs.reverse();
      // group by elements[0].value::attachment
      async.each(defs, this.preprocess.bind(this), function(err) {
        var layers = {};
        for(var i = 0; i < defs.length; ++i) {
          var def = defs[i];
          var key = defKey(def);
          var layer = layers[key] = (layers[key] || {
            symbolizers: []
          });
          for(var u = 0; u<def.rules.length; u++){
              if(def.rules[u].name === "marker-file" || def.rules[u].name === "point-file"){
                  var value = def.rules[u].value.value[0].value[0].value.value;
                  this.imageURLs.push(value);
              }
          } 
          layer.frames = [];
          layer.zoom = tree.Zoom.all;
          var props = def.toJS(parse_env);
          if (self.options.debug) console.log("props", props);
          for(var v in props) {
            var lyr = layer[v] = layer[v] || {
              constant: false,
              symbolizer: null,
              js: [],
              index: 0
            };
            // build javascript statements
            lyr.js.push(props[v].map(function(a) { return a.js; }).join('\n'));
            // get symbolizer for prop
            lyr.symbolizer = _.first(props[v].map(function(a) { return a.symbolizer; }));
            // serach the max index to know rendering order
            lyr.index = _.max(props[v].map(function(a) { return a.index; }).concat(lyr.index));
            lyr.constant = !_.any(props[v].map(function(a) { return !a.constant; }));
          }
        }
        var ordered_layers = [];
        if (self.options.debug) console.log(layers);

        var done = {};
        for(var i = 0; i < defs.length; ++i) {
          var def = defs[i];
          var k = defKey(def);
          var layer = layers[k];
          if(!done[k]) {
            if(self.options.debug) console.log("**", k);
            for(var prop in layer) {
              if (prop !== 'zoom' && prop !== 'frames' && prop !== 'symbolizers') {
                if(self.options.debug) console.log("*", prop);
                layer[prop].style = self._createFn(layer[prop].js);
                layer.symbolizers.push(layer[prop].symbolizer);
                layer.symbolizers = _.uniq(layer.symbolizers);
              }
            }
            layer.attachment = k;
            ordered_layers.push(layer);
            done[k] = true;
          }
          layer.zoom |= def.zoom;
          layer.frames.push(def.frame_offset);
        }

        // uniq the frames
        for(i = 0; i < ordered_layers.length; ++i) {
          ordered_layers[i].frames = _.uniq(ordered_layers[i].frames);
        }

        self.layers = ordered_layers.map(function(shader) {
            return new CartoCSS.Layer(shader);
        });

        callback(null, self.layers);
        return;
      });

    } else {
      callback(new Error("not rules found"));
    }
  }
};


carto.RendererJS = function (options) {
    this.options = options || {};
    this.options.mapnik_version = this.options.mapnik_version || 'latest';
    this._functions = {}
};

// Prepare a javascript object which contains the layers
carto.RendererJS.prototype.render = function render(cartocss, callback) {
    var reference = require('./torque-reference');
    tree.Reference.setData(reference.version.latest);
    if (cartocss) {
      CartoCSS.parse(cartocss, _.extend({}, this.options, { functions: this._functions }), callback);
    }
}
carto.RendererJS.prototype.addFunction = function(name, process) {
    this._functions[name] = process;
}

if(typeof(module) !== 'undefined') {
  module.exports = carto.RendererJS;
}


})(require('../carto'));

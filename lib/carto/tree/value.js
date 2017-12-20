(function(tree) {

tree.Value = function Value(value) {
    this.value = value;
};

tree.Value.prototype = {
    is: 'value',
    ev: function(env) {
        if (this.value.length === 1) {
            return this.value[0].ev(env);
        } else {
            return new tree.Value(this.value.map(function(v) {
                return v.ev(env);
            }));
        }
    },
    toString: function(env, selector, sep, format) {
        return this.value.map(function(e) {
            return e.toString(env, format);
        }).join(sep || ', ');
    },
    clone: function() {
        var obj = Object.create(tree.Value.prototype);
        if (Array.isArray(obj)) obj.value = this.value.slice();
        else obj.value = this.value;
        obj.is = this.is;
        return obj;
    },

    toJS: function(env) {
      //var v = this.value[0].value[0];
      var val = this.ev(env);
      var v = val.toString();
      if(val.is === "color" || val.is === 'uri' || val.is === 'string' || val.is === 'keyword') {
        v = "'" + v.replace(/&amp;/g, '&') + "'";
      } else if (Array.isArray(this.value) && this.value.length > 1) {
        // This covers something like `line-dasharray: 5, 10;`
        // where the return _value has more than one element.
        // Without this the generated code will look like:
        // _value = 5, 10; which will ignore the 10.
        v = '[' + this.value.join(',') + ']';
      } else if (val.is === 'field') {
        // replace [variable] by ctx['variable']
        v = v.replace(/\[([^\]]*)\]/g, function(matched) {
            return matched.replace(/\[(.*)\]/g, "data['$1']");
        });
      }else if (val.is === 'call') {
        v = JSON.stringify({
            name: val.name,
            args: val.args
        })
      }
      return "_value = " + v + ";";
    }

};

})(require('../tree'));


(function(l, i, v, e) { v = l.createElement(i); v.async = 1; v.src = '//' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; e = l.getElementsByTagName(i)[0]; e.parentNode.insertBefore(v, e)})(document, 'script');
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data !== data)
            text.data = data;
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function createEventDispatcher() {
        const component = current_component;
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment) {
            $$.update($$.dirty);
            run_all($$.before_update);
            $$.fragment.p($$.dirty, $$.ctx);
            $$.dirty = null;
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined' ? window : global);
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        if (component.$$.fragment) {
            run_all(component.$$.on_destroy);
            component.$$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            component.$$.on_destroy = component.$$.fragment = null;
            component.$$.ctx = {};
        }
    }
    function make_dirty(component, key) {
        if (!component.$$.dirty) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty = blank_object();
        }
        component.$$.dirty[key] = true;
    }
    function init(component, options, instance, create_fragment, not_equal, prop_names) {
        const parent_component = current_component;
        set_current_component(component);
        const props = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props: prop_names,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty: null
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, props, (key, value) => {
                if ($$.ctx && not_equal($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
            })
            : props;
        $$.update();
        ready = true;
        run_all($$.before_update);
        $$.fragment = create_fragment($$.ctx);
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    /* src/Components/VariableType.svelte generated by Svelte v3.6.7 */

    const file = "src/Components/VariableType.svelte";

    function create_fragment(ctx) {
    	var button, t0, t1, h2, t2, dispose;

    	return {
    		c: function create() {
    			button = element("button");
    			t0 = text(ctx.text);
    			t1 = space();
    			h2 = element("h2");
    			t2 = text(ctx.value);
    			attr(button, "id", ctx.name);
    			attr(button, "class", "mzp-c-button mzp-t-secondary");
    			add_location(button, file, 20, 0, 353);
    			attr(h2, "class", ctx.name);
    			add_location(h2, file, 23, 0, 452);
    			dispose = listen(button, "click", ctx.selectValue);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, button, anchor);
    			append(button, t0);
    			insert(target, t1, anchor);
    			insert(target, h2, anchor);
    			append(h2, t2);
    		},

    		p: function update(changed, ctx) {
    			if (changed.text) {
    				set_data(t0, ctx.text);
    			}

    			if (changed.name) {
    				attr(button, "id", ctx.name);
    			}

    			if (changed.value) {
    				set_data(t2, ctx.value);
    			}

    			if (changed.name) {
    				attr(h2, "class", ctx.name);
    			}
    		},

    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(button);
    				detach(t1);
    				detach(h2);
    			}

    			dispose();
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let { name = "dummy", value = "dummy", text = "dummy", color = "" } = $$props;

      const dispatch = createEventDispatcher();

      function selectValue() {
        dispatch("select", {
          name: name,
          value: value
        });
      }

    	const writable_props = ['name', 'value', 'text', 'color'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<VariableType> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ('name' in $$props) $$invalidate('name', name = $$props.name);
    		if ('value' in $$props) $$invalidate('value', value = $$props.value);
    		if ('text' in $$props) $$invalidate('text', text = $$props.text);
    		if ('color' in $$props) $$invalidate('color', color = $$props.color);
    	};

    	return { name, value, text, color, selectValue };
    }

    class VariableType extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, ["name", "value", "text", "color"]);
    	}

    	get name() {
    		throw new Error("<VariableType>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<VariableType>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get value() {
    		throw new Error("<VariableType>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<VariableType>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get text() {
    		throw new Error("<VariableType>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set text(value) {
    		throw new Error("<VariableType>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get color() {
    		throw new Error("<VariableType>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<VariableType>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Components/SelectValue.svelte generated by Svelte v3.6.7 */

    const file$1 = "src/Components/SelectValue.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.value = list[i];
    	return child_ctx;
    }

    // (108:12) {#each values as value}
    function create_each_block(ctx) {
    	var li, label, input, input_name_value, input_value_value, t0, t1_value = ctx.value, t1, label_for_value, t2;

    	return {
    		c: function create() {
    			li = element("li");
    			label = element("label");
    			input = element("input");
    			t0 = space();
    			t1 = text(t1_value);
    			t2 = space();
    			attr(input, "type", "checkbox");
    			attr(input, "name", input_name_value = "checkbox-" + ctx.variable + "-" + ctx.value);
    			input.value = input_value_value = ctx.value;
    			add_location(input, file$1, 111, 18, 3295);
    			attr(label, "for", label_for_value = ctx.value);
    			add_location(label, file$1, 109, 16, 3256);
    			add_location(li, file$1, 108, 14, 3235);
    		},

    		m: function mount(target, anchor) {
    			insert(target, li, anchor);
    			append(li, label);
    			append(label, input);
    			append(label, t0);
    			append(label, t1);
    			append(li, t2);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.variable || changed.values) && input_name_value !== (input_name_value = "checkbox-" + ctx.variable + "-" + ctx.value)) {
    				attr(input, "name", input_name_value);
    			}

    			if ((changed.values) && input_value_value !== (input_value_value = ctx.value)) {
    				input.value = input_value_value;
    			}

    			if ((changed.values) && t1_value !== (t1_value = ctx.value)) {
    				set_data(t1, t1_value);
    			}

    			if ((changed.values) && label_for_value !== (label_for_value = ctx.value)) {
    				attr(label, "for", label_for_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(li);
    			}
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	var div4, div3, div2, header, h2, t0, t1, t2, div0, button0, t4, div1, fieldset, ul, li, input, t5, button1, t6, t7, t8, ul_id_value, t9, button2, dispose;

    	var each_value = ctx.values;

    	var each_blocks = [];

    	for (var i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c: function create() {
    			div4 = element("div");
    			div3 = element("div");
    			div2 = element("div");
    			header = element("header");
    			h2 = element("h2");
    			t0 = text("Select ");
    			t1 = text(ctx.variable);
    			t2 = space();
    			div0 = element("div");
    			button0 = element("button");
    			button0.textContent = "Close";
    			t4 = space();
    			div1 = element("div");
    			fieldset = element("fieldset");
    			ul = element("ul");
    			li = element("li");
    			input = element("input");
    			t5 = space();
    			button1 = element("button");
    			t6 = text("Add ");
    			t7 = text(ctx.variable);
    			t8 = space();

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t9 = space();
    			button2 = element("button");
    			button2.textContent = "Close";
    			add_location(h2, file$1, 83, 8, 2450);
    			add_location(header, file$1, 82, 6, 2433);
    			attr(button0, "type", "button");
    			attr(button0, "class", "mzp-c-modal-button-close");
    			attr(button0, "title", "Close modal");
    			add_location(button0, file$1, 86, 8, 2540);
    			attr(div0, "class", "mzp-c-modal-close");
    			add_location(div0, file$1, 85, 6, 2500);
    			attr(input, "type", "text");
    			attr(input, "name", "text");
    			attr(input, "id", "text");
    			add_location(input, file$1, 99, 14, 2881);
    			attr(button1, "type", "button");
    			attr(button1, "class", "mzp-c-button mzp-t-secondary mzp-t-small mzp-t-dark");
    			add_location(button1, file$1, 100, 14, 2961);
    			add_location(li, file$1, 98, 12, 2862);
    			attr(ul, "id", ul_id_value = "list-" + ctx.variable);
    			add_location(ul, file$1, 97, 10, 2824);
    			add_location(fieldset, file$1, 96, 8, 2803);
    			attr(button2, "class", "mzp-c-button mzp-t-secondary mzp-t-dark");
    			add_location(button2, file$1, 123, 8, 3562);
    			attr(div1, "class", "mzp-u-modal-content mzp-c-modal-overlay-contents");
    			add_location(div1, file$1, 94, 6, 2731);
    			attr(div2, "class", "mzp-c-modal-inner");
    			add_location(div2, file$1, 80, 4, 2394);
    			attr(div3, "class", "mzp-c-modal-window");
    			add_location(div3, file$1, 78, 2, 2356);
    			attr(div4, "class", "mzp-c-modal mzp-has-media");
    			attr(div4, "role", "dialog");
    			add_location(div4, file$1, 77, 0, 2300);

    			dispose = [
    				listen(button0, "click", ctx.closeModal),
    				listen(input, "input", ctx.input_input_handler),
    				listen(button1, "click", ctx.addValue),
    				listen(button2, "click", ctx.closeModal)
    			];
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div4, anchor);
    			append(div4, div3);
    			append(div3, div2);
    			append(div2, header);
    			append(header, h2);
    			append(h2, t0);
    			append(h2, t1);
    			append(div2, t2);
    			append(div2, div0);
    			append(div0, button0);
    			append(div2, t4);
    			append(div2, div1);
    			append(div1, fieldset);
    			append(fieldset, ul);
    			append(ul, li);
    			append(li, input);

    			input.value = ctx.newvalue;

    			append(li, t5);
    			append(li, button1);
    			append(button1, t6);
    			append(button1, t7);
    			append(ul, t8);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			append(div1, t9);
    			append(div1, button2);
    		},

    		p: function update(changed, ctx) {
    			if (changed.variable) {
    				set_data(t1, ctx.variable);
    			}

    			if (changed.newvalue && (input.value !== ctx.newvalue)) input.value = ctx.newvalue;

    			if (changed.variable) {
    				set_data(t7, ctx.variable);
    			}

    			if (changed.values || changed.variable) {
    				each_value = ctx.values;

    				for (var i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}
    				each_blocks.length = each_value.length;
    			}

    			if ((changed.variable) && ul_id_value !== (ul_id_value = "list-" + ctx.variable)) {
    				attr(ul, "id", ul_id_value);
    			}
    		},

    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div4);
    			}

    			destroy_each(each_blocks, detaching);

    			run_all(dispose);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	
      const dispatch = createEventDispatcher();
      onMount(() => {
        selectAll();
      });

      let { variable, values, selectedvalues } = $$props;

      let newvalue = "";

      function closeModal() {
        let sel = selected(variable);
        dispatch("selected", {
          name: variable,
          value: sel
        });

        dispatch("close");
      }

      function addValue() {
        if (newvalue === "") return;
        $$invalidate('newvalue', newvalue = newvalue.replace(/ /g, ""));
        dispatch("newvalue", {
          name: variable,
          value: newvalue
        });

        // <li>
        //   <label for={value}>
        //     <input type="checkbox" name={variable} id={value} />
        //      {value}
        //   </label>
        // </li>

        let li = document.createElement("li"); // Create a <li> node
        let label = document.createElement("label"); // Create a <li> node
        let input = document.createElement("input");

        let inputAttributeType = document.createAttribute("type");
        inputAttributeType.value = "checkbox"; // Create a "class" attribute
        let inputAttributeName = document.createAttribute("name");
        inputAttributeName.value = `checkbox-${variable}-${newvalue}`; // Create a "class" attribute
        let inputAttributeId = document.createAttribute("id"); // Create a "class" attribute
        inputAttributeId.value = newvalue;

        //
        // let inputAttributeClick = document.createAttribute("onclick"); // Create a "class" attribute
        // inputAttributeClick.value = `() => (showSelectValueModal = false)`;

        let labelAttributeFor = document.createAttribute("for");
        labelAttributeFor.value = newvalue;
        label.setAttributeNode(labelAttributeFor);

        input.setAttributeNode(inputAttributeId);
        input.setAttributeNode(inputAttributeType);
        input.setAttributeNode(inputAttributeName);
        input.value = newvalue;

        let textnode = document.createTextNode(newvalue);
        label.appendChild(input);
        label.appendChild(textnode);
        li.appendChild(label);

        let list = document.getElementById(`list-${variable}`);
        // list.insertBefore(li, list.childNodes[values.length]);
        list.insertBefore(li, list.childNodes[1]);
        // list.appendChild(li);
        // selected.push(newvalue);
        $$invalidate('newvalue', newvalue = "");
      }

    	const writable_props = ['variable', 'values', 'selectedvalues'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<SelectValue> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		newvalue = this.value;
    		$$invalidate('newvalue', newvalue);
    	}

    	$$self.$set = $$props => {
    		if ('variable' in $$props) $$invalidate('variable', variable = $$props.variable);
    		if ('values' in $$props) $$invalidate('values', values = $$props.values);
    		if ('selectedvalues' in $$props) $$invalidate('selectedvalues', selectedvalues = $$props.selectedvalues);
    	};

    	return {
    		variable,
    		values,
    		selectedvalues,
    		newvalue,
    		closeModal,
    		addValue,
    		input_input_handler
    	};
    }

    class SelectValue extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, ["variable", "values", "selectedvalues"]);

    		const { ctx } = this.$$;
    		const props = options.props || {};
    		if (ctx.variable === undefined && !('variable' in props)) {
    			console.warn("<SelectValue> was created without expected prop 'variable'");
    		}
    		if (ctx.values === undefined && !('values' in props)) {
    			console.warn("<SelectValue> was created without expected prop 'values'");
    		}
    		if (ctx.selectedvalues === undefined && !('selectedvalues' in props)) {
    			console.warn("<SelectValue> was created without expected prop 'selectedvalues'");
    		}
    	}

    	get variable() {
    		throw new Error("<SelectValue>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set variable(value) {
    		throw new Error("<SelectValue>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get values() {
    		throw new Error("<SelectValue>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set values(value) {
    		throw new Error("<SelectValue>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get selectedvalues() {
    		throw new Error("<SelectValue>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set selectedvalues(value) {
    		throw new Error("<SelectValue>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (!stop) {
                    return; // not ready
                }
                subscribers.forEach((s) => s[1]());
                subscribers.forEach((s) => s[0](value));
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    let possibilities = {};
    possibilities["artifact"] = ["anexperience", "animage", "aconcept"];
    possibilities["inspiration"] = ["circles", "Africanfashion", "curves"];
    possibilities["experience"] = ["trusting", "chaotic", "explosive"];
    possibilities["attribute"] = ["forms", "brandtouchpoints", "textures"];
    possibilities["media"] = ["fabric", "pen&paper", "code"];

    const possibilitiesStore = writable(possibilities);

    /* src/Components/Statement.svelte generated by Svelte v3.6.7 */
    const { Object: Object_1, console: console_1 } = globals;

    const file$2 = "src/Components/Statement.svelte";

    // (142:0) {#if showSelectValueModal}
    function create_if_block(ctx) {
    	var current;

    	var selectvalue = new SelectValue({
    		props: {
    		variable: ctx.selectedVariable,
    		values: ctx.possibilities[ctx.selectedVariable],
    		selectedvalues: ctx.selected_values
    	},
    		$$inline: true
    	});
    	selectvalue.$on("newvalue", ctx.addValue);
    	selectvalue.$on("selected", ctx.selected);
    	selectvalue.$on("close", ctx.close_handler);

    	return {
    		c: function create() {
    			selectvalue.$$.fragment.c();
    		},

    		m: function mount(target, anchor) {
    			mount_component(selectvalue, target, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var selectvalue_changes = {};
    			if (changed.selectedVariable) selectvalue_changes.variable = ctx.selectedVariable;
    			if (changed.possibilities || changed.selectedVariable) selectvalue_changes.values = ctx.possibilities[ctx.selectedVariable];
    			if (changed.selected_values) selectvalue_changes.selectedvalues = ctx.selected_values;
    			selectvalue.$set(selectvalue_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(selectvalue.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(selectvalue.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			destroy_component(selectvalue, detaching);
    		}
    	};
    }

    function create_fragment$2(ctx) {
    	var article, section0, t0, section1, t1, section2, t2, section3, t3, section4, t4, button, t6, if_block_anchor, current, dispose;

    	var variabletype0 = new VariableType({
    		props: {
    		name: "artifact",
    		text: "Design",
    		value: ctx.variables['artifact']
    	},
    		$$inline: true
    	});
    	variabletype0.$on("select", ctx.selectValue);

    	var variabletype1 = new VariableType({
    		props: {
    		name: "inspiration",
    		text: "inspired by",
    		value: ctx.variables['inspiration']
    	},
    		$$inline: true
    	});
    	variabletype1.$on("select", ctx.selectValue);

    	var variabletype2 = new VariableType({
    		props: {
    		name: "experience",
    		text: "that is",
    		value: ctx.variables['experience']
    	},
    		$$inline: true
    	});
    	variabletype2.$on("select", ctx.selectValue);

    	var variabletype3 = new VariableType({
    		props: {
    		name: "attribute",
    		text: "through",
    		value: ctx.variables['attribute']
    	},
    		$$inline: true
    	});
    	variabletype3.$on("select", ctx.selectValue);

    	var variabletype4 = new VariableType({
    		props: {
    		name: "media",
    		text: "using",
    		value: ctx.variables['media']
    	},
    		$$inline: true
    	});
    	variabletype4.$on("select", ctx.selectValue);

    	var if_block = (ctx.showSelectValueModal) && create_if_block(ctx);

    	return {
    		c: function create() {
    			article = element("article");
    			section0 = element("section");
    			variabletype0.$$.fragment.c();
    			t0 = space();
    			section1 = element("section");
    			variabletype1.$$.fragment.c();
    			t1 = space();
    			section2 = element("section");
    			variabletype2.$$.fragment.c();
    			t2 = space();
    			section3 = element("section");
    			variabletype3.$$.fragment.c();
    			t3 = space();
    			section4 = element("section");
    			variabletype4.$$.fragment.c();
    			t4 = space();
    			button = element("button");
    			button.textContent = "Randomize";
    			t6 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr(section0, "class", "mzp-has-aspect-3-2 ");
    			add_location(section0, file$2, 103, 2, 3015);
    			attr(section1, "class", "mzp-has-aspect-3-2 ");
    			add_location(section1, file$2, 110, 2, 3197);
    			attr(section2, "class", "mzp-has-aspect-3-2 ");
    			add_location(section2, file$2, 117, 2, 3390);
    			attr(section3, "class", "mzp-has-aspect-3-2 ");
    			add_location(section3, file$2, 124, 2, 3577);
    			attr(section4, "class", "mzp-has-aspect-3-2 ");
    			add_location(section4, file$2, 131, 2, 3762);
    			add_location(article, file$2, 102, 0, 3003);
    			attr(button, "class", "mzp-c-button");
    			add_location(button, file$2, 139, 0, 3946);
    			dispose = listen(button, "click", ctx.randomize);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, article, anchor);
    			append(article, section0);
    			mount_component(variabletype0, section0, null);
    			append(article, t0);
    			append(article, section1);
    			mount_component(variabletype1, section1, null);
    			append(article, t1);
    			append(article, section2);
    			mount_component(variabletype2, section2, null);
    			append(article, t2);
    			append(article, section3);
    			mount_component(variabletype3, section3, null);
    			append(article, t3);
    			append(article, section4);
    			mount_component(variabletype4, section4, null);
    			insert(target, t4, anchor);
    			insert(target, button, anchor);
    			insert(target, t6, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var variabletype0_changes = {};
    			if (changed.variables) variabletype0_changes.value = ctx.variables['artifact'];
    			variabletype0.$set(variabletype0_changes);

    			var variabletype1_changes = {};
    			if (changed.variables) variabletype1_changes.value = ctx.variables['inspiration'];
    			variabletype1.$set(variabletype1_changes);

    			var variabletype2_changes = {};
    			if (changed.variables) variabletype2_changes.value = ctx.variables['experience'];
    			variabletype2.$set(variabletype2_changes);

    			var variabletype3_changes = {};
    			if (changed.variables) variabletype3_changes.value = ctx.variables['attribute'];
    			variabletype3.$set(variabletype3_changes);

    			var variabletype4_changes = {};
    			if (changed.variables) variabletype4_changes.value = ctx.variables['media'];
    			variabletype4.$set(variabletype4_changes);

    			if (ctx.showSelectValueModal) {
    				if (if_block) {
    					if_block.p(changed, ctx);
    					transition_in(if_block, 1);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();
    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});
    				check_outros();
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(variabletype0.$$.fragment, local);

    			transition_in(variabletype1.$$.fragment, local);

    			transition_in(variabletype2.$$.fragment, local);

    			transition_in(variabletype3.$$.fragment, local);

    			transition_in(variabletype4.$$.fragment, local);

    			transition_in(if_block);
    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(variabletype0.$$.fragment, local);
    			transition_out(variabletype1.$$.fragment, local);
    			transition_out(variabletype2.$$.fragment, local);
    			transition_out(variabletype3.$$.fragment, local);
    			transition_out(variabletype4.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(article);
    			}

    			destroy_component(variabletype0, );

    			destroy_component(variabletype1, );

    			destroy_component(variabletype2, );

    			destroy_component(variabletype3, );

    			destroy_component(variabletype4, );

    			if (detaching) {
    				detach(t4);
    				detach(button);
    				detach(t6);
    			}

    			if (if_block) if_block.d(detaching);

    			if (detaching) {
    				detach(if_block_anchor);
    			}

    			dispose();
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	

      // export let artifacts = ["a1", "a2", "a3"];
      // export let inspirations = ["i1", "i2", "i3"];
      // export let experiences = ["e1", "e2", "e3"];
      // export let attributes = ["at1", "at2", "at3"];
      // export let medias = ["m1", "m2", "m3"];

      let { possibilities = {} } = $$props;
      let selected_possibilities = Object.assign({}, possibilities);
      const unsubscribe = possibilitiesStore.subscribe(value => {
        $$invalidate('possibilities', possibilities = value);
        selected_possibilities = Object.assign({}, possibilities);
      });

      console.log(possibilities);
      // possibilities["artifact"] = ["a1", "a2", "a3"];
      // possibilities["inspiration"] = ["i1", "i2", "i3"];
      // possibilities["experience"] = ["e1", "e2", "e3"];
      // possibilities["attribute"] = ["at1", "at2", "at3"];
      // possibilities["media"] = ["m1", "m2", "m3"];
      let showSelectValueModal = false;
      let selectedVariable;

      function selectValue(event) {
        let { name, value } = event.detail;
        $$invalidate('selectedVariable', selectedVariable = name);
        // console.log("sel2", sel);
        $$invalidate('showSelectValueModal', showSelectValueModal = true);
        // clearInterval(interval);

        // console.log(name, value);
      }

      let variables = {};
      variables["artifact"] = ""; $$invalidate('variables', variables);
      variables["inspiration"] = ""; $$invalidate('variables', variables);
      variables["experience"] = ""; $$invalidate('variables', variables);
      variables["attribute"] = ""; $$invalidate('variables', variables);
      variables["media"] = ""; $$invalidate('variables', variables);

      let all = ["artifact", "inspiration", "experience", "attribute", "media"];
      let constants = [
        // "artifact",
        // "inspiration",
        // "experience",
        // "attribute",
        // "media"
      ];
      let selected_values = {};
      function selected(event) {
        let { name, value } = event.detail;

        if (value.length == 0) {
          // undoConstant(name);
          selected_values[name] = []; $$invalidate('selected_values', selected_values);
          selectVariableValue(name, possibilities[name]);
        } else {
          // makeConstant(name);

          let _values = value.map(v => v.split("-")[2]);
          selected_values[name] = _values; $$invalidate('selected_values', selected_values);
          selectVariableValue(name, _values);
        }
      }

      function selectVariableValue(variable, values) {
        // CHECK ("selected variable", variable, _values);
        selected_possibilities[variable] = values;  }
      // undoConstant("media");
      // undoConstant("experience");
      // makeConstant("experience");

      function randomize(constant = constants) {
        let to_randomize = all.filter(v => (constants.includes(v) ? false : true));
        for (let v of to_randomize) {
          variables[v] =
            selected_possibilities[v][
              Math.floor(Math.random() * selected_possibilities[v].length)
            ]; $$invalidate('variables', variables);
        }
      }

      function addValue(event) {
        let { name, value } = event.detail;
        possibilities[name].unshift(value);
      }
      randomize();

    	const writable_props = ['possibilities'];
    	Object_1.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console_1.warn(`<Statement> was created with unknown prop '${key}'`);
    	});

    	function close_handler() {
    		const $$result = (showSelectValueModal = false);
    		$$invalidate('showSelectValueModal', showSelectValueModal);
    		return $$result;
    	}

    	$$self.$set = $$props => {
    		if ('possibilities' in $$props) $$invalidate('possibilities', possibilities = $$props.possibilities);
    	};

    	return {
    		possibilities,
    		showSelectValueModal,
    		selectedVariable,
    		selectValue,
    		variables,
    		selected_values,
    		selected,
    		randomize,
    		addValue,
    		close_handler
    	};
    }

    class Statement extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, ["possibilities"]);
    	}

    	get possibilities() {
    		throw new Error("<Statement>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set possibilities(value) {
    		throw new Error("<Statement>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Components/FileUpload.svelte generated by Svelte v3.6.7 */

    const file$3 = "src/Components/FileUpload.svelte";

    function create_fragment$3(ctx) {
    	var div6, div5, div2, header0, h20, t1, div0, button0, t3, div1, label0, t4, br, t5, input, t6, button1, t8, button2, t10, div4, header1, h21, t12, div3, label1, t14, h5, dispose;

    	return {
    		c: function create() {
    			div6 = element("div");
    			div5 = element("div");
    			div2 = element("div");
    			header0 = element("header");
    			h20 = element("h2");
    			h20.textContent = "Upload";
    			t1 = space();
    			div0 = element("div");
    			button0 = element("button");
    			button0.textContent = "Close";
    			t3 = space();
    			div1 = element("div");
    			label0 = element("label");
    			t4 = text("Please upload your variables\n          ");
    			br = element("br");
    			t5 = space();
    			input = element("input");
    			t6 = space();
    			button1 = element("button");
    			button1.textContent = "Upload";
    			t8 = space();
    			button2 = element("button");
    			button2.textContent = "Close";
    			t10 = space();
    			div4 = element("div");
    			header1 = element("header");
    			h21 = element("h2");
    			h21.textContent = "Download";
    			t12 = space();
    			div3 = element("div");
    			label1 = element("label");
    			label1.textContent = "Download your variables as a file";
    			t14 = space();
    			h5 = element("h5");
    			h5.textContent = "Comming Soon!";
    			add_location(h20, file$3, 128, 8, 3935);
    			add_location(header0, file$3, 127, 6, 3918);
    			attr(button0, "type", "button");
    			attr(button0, "class", "mzp-c-modal-button-close");
    			attr(button0, "title", "Close modal");
    			add_location(button0, file$3, 132, 8, 4014);
    			attr(div0, "class", "mzp-c-modal-close");
    			add_location(div0, file$3, 131, 6, 3974);
    			add_location(br, file$3, 144, 10, 4345);
    			attr(input, "type", "file");
    			attr(input, "name", "variablescsv");
    			attr(input, "accept", ".csv");
    			attr(input, "id", "variablescsv");
    			add_location(input, file$3, 145, 10, 4362);
    			attr(label0, "for", "text");
    			add_location(label0, file$3, 142, 8, 4277);
    			attr(button1, "class", "mzp-c-button mzp-t-secondary mzp-t-dark");
    			add_location(button1, file$3, 151, 8, 4509);
    			attr(button2, "class", "mzp-c-button mzp-t-secondary mzp-t-dark");
    			add_location(button2, file$3, 157, 8, 4648);
    			attr(div1, "class", "mzp-u-modal-content mzp-c-modal-overlay-contents");
    			add_location(div1, file$3, 141, 6, 4206);
    			attr(div2, "class", "mzp-c-modal-inner");
    			add_location(div2, file$3, 125, 4, 3879);
    			add_location(h21, file$3, 167, 8, 4865);
    			add_location(header1, file$3, 166, 6, 4848);
    			attr(label1, "for", "text");
    			add_location(label1, file$3, 170, 8, 4976);
    			add_location(h5, file$3, 171, 8, 5044);
    			attr(div3, "class", "mzp-u-modal-content mzp-c-modal-overlay-contents");
    			add_location(div3, file$3, 169, 6, 4905);
    			attr(div4, "class", "mzp-c-modal-inner");
    			add_location(div4, file$3, 165, 4, 4810);
    			attr(div5, "class", "mzp-c-modal-window");
    			add_location(div5, file$3, 123, 2, 3841);
    			attr(div6, "class", "mzp-c-modal mzp-has-media");
    			attr(div6, "role", "dialog");
    			add_location(div6, file$3, 122, 0, 3785);

    			dispose = [
    				listen(button0, "click", ctx.closeModal),
    				listen(button1, "click", ctx.upload),
    				listen(button2, "click", ctx.closeModal)
    			];
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div6, anchor);
    			append(div6, div5);
    			append(div5, div2);
    			append(div2, header0);
    			append(header0, h20);
    			append(div2, t1);
    			append(div2, div0);
    			append(div0, button0);
    			append(div2, t3);
    			append(div2, div1);
    			append(div1, label0);
    			append(label0, t4);
    			append(label0, br);
    			append(label0, t5);
    			append(label0, input);
    			append(div1, t6);
    			append(div1, button1);
    			append(div1, t8);
    			append(div1, button2);
    			append(div5, t10);
    			append(div5, div4);
    			append(div4, header1);
    			append(header1, h21);
    			append(div4, t12);
    			append(div4, div3);
    			append(div3, label1);
    			append(div3, t14);
    			append(div3, h5);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div6);
    			}

    			run_all(dispose);
    		}
    	};
    }

    function CSVToArray(strData, strDelimiter) {
      // Check to see if the delimiter is defined. If not,
      // then default to comma.
      strDelimiter = strDelimiter || ",";

      // Create a regular expression to parse the CSV values.
      var objPattern = new RegExp(
        // Delimiters.
        "(\\" +
          strDelimiter +
          "|\\r?\\n|\\r|^)" +
          // Quoted fields.
          '(?:"([^"]*(?:""[^"]*)*)"|' +
          // Standard fields.
          '([^"\\' +
          strDelimiter +
          "\\r\\n]*))",
        "gi"
      );

      // Create an array to hold our data. Give the array
      // a default empty first row.
      var arrData = [[]];

      // Create an array to hold our individual pattern
      // matching groups.
      var arrMatches = null;

      // Keep looping over the regular expression matches
      // until we can no longer find a match.
      while ((arrMatches = objPattern.exec(strData))) {
        // Get the delimiter that was found.
        var strMatchedDelimiter = arrMatches[1];

        // Check to see if the given delimiter has a length
        // (is not the start of string) and if it matches
        // field delimiter. If id does not, then we know
        // that this delimiter is a row delimiter.
        if (strMatchedDelimiter.length && strMatchedDelimiter !== strDelimiter) {
          // Since we have reached a new row of data,
          // add an empty row to our data array.
          arrData.push([]);
        }

        var strMatchedValue;

        // Now that we have our delimiter out of the way,
        // let's check to see which kind of value we
        // captured (quoted or unquoted).
        if (arrMatches[2]) {
          // We found a quoted value. When we capture
          // this value, unescape any double quotes.
          strMatchedValue = arrMatches[2].replace(new RegExp('""', "g"), '"');
        } else {
          // We found a non-quoted value.
          strMatchedValue = arrMatches[3];
        }

        // Now that we have our value string, let's add
        // it to the data array.
        arrData[arrData.length - 1].push(strMatchedValue);
      }

      // Return the parsed data.
      return arrData;
    }

    function instance$3($$self) {
    	

      const dispatch = createEventDispatcher();

      function closeModal() {
        dispatch("close");
      }

      function upload() {
        let file = document.getElementById("variablescsv").files[0];
        var reader = new FileReader();
        reader.readAsText(file);
        reader.onload = function(event) {
          var csvData = event.target.result;
          let data = CSVToArray(csvData);
          if (data && data.length > 0) {
            closeModal();
            dispatch("data", {
              name: "data",
              value: csvData
            });
          } else {
            alert("No data to import!");
          }
        };
        reader.onerror = function() {
          alert("Unable to read " + file.fileName);
        };
        console.log(file);
        let csv = CSVToArray(file);
      }

    	return { closeModal, upload };
    }

    class FileUpload extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, []);
    	}
    }

    /* src/App.svelte generated by Svelte v3.6.7 */

    const file$4 = "src/App.svelte";

    // (62:2) {#if showUploadeModal}
    function create_if_block$1(ctx) {
    	var current;

    	var uploadmodal = new FileUpload({ $$inline: true });
    	uploadmodal.$on("data", ctx.onData);
    	uploadmodal.$on("close", ctx.close_handler);

    	return {
    		c: function create() {
    			uploadmodal.$$.fragment.c();
    		},

    		m: function mount(target, anchor) {
    			mount_component(uploadmodal, target, anchor);
    			current = true;
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(uploadmodal.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(uploadmodal.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			destroy_component(uploadmodal, detaching);
    		}
    	};
    }

    function create_fragment$4(ctx) {
    	var div, main, t0, button, t2, current, dispose;

    	var statement = new Statement({ $$inline: true });

    	var if_block = (ctx.showUploadeModal) && create_if_block$1(ctx);

    	return {
    		c: function create() {
    			div = element("div");
    			main = element("main");
    			statement.$$.fragment.c();
    			t0 = space();
    			button = element("button");
    			button.textContent = "Input";
    			t2 = space();
    			if (if_block) if_block.c();
    			attr(button, "class", "mzp-c-button");
    			add_location(button, file$4, 57, 4, 1742);
    			attr(main, "class", "mzp-l-main");
    			add_location(main, file$4, 55, 2, 1694);
    			attr(div, "class", "mzp-l-content");
    			add_location(div, file$4, 54, 0, 1664);
    			dispose = listen(button, "click", ctx.openUploadModal);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    			append(div, main);
    			mount_component(statement, main, null);
    			append(main, t0);
    			append(main, button);
    			append(div, t2);
    			if (if_block) if_block.m(div, null);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (ctx.showUploadeModal) {
    				if (!if_block) {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div, null);
    				} else {
    									transition_in(if_block, 1);
    				}
    			} else if (if_block) {
    				group_outros();
    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});
    				check_outros();
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(statement.$$.fragment, local);

    			transition_in(if_block);
    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(statement.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    			}

    			destroy_component(statement, );

    			if (if_block) if_block.d();
    			dispose();
    		}
    	};
    }

    function instance$4($$self, $$props, $$invalidate) {
    	

      let showUploadeModal = false;

      let possibilities = {};

      function openUploadModal() {
        $$invalidate('showUploadeModal', showUploadeModal = true);
      }

      function onData(event) {
        let { name, value } = event.detail;
        //0 artifact
        //1 inspiration
        //2 experience
        //3 attribute
        //4 media
        var results = Papa.parse(value, {
          delimiter: "", // auto-detect
          newline: "", // auto-detect
          header: true,
          delimitersToGuess: [",", "\t", "|", ";", Papa.RECORD_SEP, Papa.UNIT_SEP]
        });

        //
        possibilities["artifact"] = [];    possibilities["inspiration"] = [];    possibilities["experience"] = [];    possibilities["attribute"] = [];    possibilities["media"] = [];    for (let d of results.data) {
          if (d.artifacts != "")
            possibilities["artifact"].push(d.artifacts.replace(/ /g, ""));
          if (d.attributes != "")
            possibilities["attribute"].push(d.attributes.replace(/ /g, ""));
          if (d.experiences != "")
            possibilities["experience"].push(d.experiences.replace(/ /g, ""));
          if (d.inspirations != "")
            possibilities["inspiration"].push(d.inspirations.replace(/ /g, ""));
          if (d.medium != "")
            possibilities["media"].push(d.medium.replace(/ /g, ""));
        }
        // console.log(possibilities);
        possibilitiesStore.set(possibilities);
        // for (let i = 0; i < value.length - 2; i++) {
        //   console.log(value[i]);
        // }
      }

    	function close_handler() {
    		const $$result = (showUploadeModal = false);
    		$$invalidate('showUploadeModal', showUploadeModal);
    		return $$result;
    	}

    	return {
    		showUploadeModal,
    		openUploadModal,
    		onData,
    		close_handler
    	};
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, []);
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map

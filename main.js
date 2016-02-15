"use strict";
var brushes = {
	dig: {label: 'Dig', code: 'd', className: 'dig', colour: 'rgb(155, 255, 155)'},
	clear: {label: 'Clear', code: '', className: ''},
	chop: {label: 'Chop', code: 't', className: 'chop'},
	downstairs: {label: 'Down stairs', code: 'i', className: 'downstairs'},
	updownstairs: {label: 'Up Down stairs', code: 'j', className: 'updownstairs'},
	upstairs: {label: 'Up stairs', code: 'k', className: 'upstairs'},
};

var overlays = {
	selected: {colour: 'rgba(255, 245, 0, 0.3)'}
}


function Range(x1, y1, x2, y2){
	if(arguments.length === 2){
		x2 = x1;
		y2 = y1;
	}
	var args = {x1: Math.min(x1,x2), x2: Math.max(x1,x2), 
		y1: Math.min(y1, y2), y2: Math.max(y1, y2)};
	return function(f){
		if(f)
			for(var x=args.x1; x<=args.x2; x++) 
				for(var y=args.y1; y<=args.y2; y++)
					f(x, y);
		return args;
		};
}

function Debounce(func, delay){
	var timeout;
	return function(){
		var args = arguments;
		if(timeout)
			clearTimeout(timeout)
		timeout = setTimeout(function(){
			func.apply(null, arguments)
		}, delay);
	};
}

function Array2D(x, y){
	this.x = x;
	this.y = y;	
	this.cells = new Array(this.y);	
	var cells = this.cells;
	for(var i=0;i<this.y;i++)
		cells[i] = new Array(this.x);	
	this.get = function(x, y){
		return cells[y][x];
	}
	this.set = function(x, y, v){
		cells[y][x] = v;
	}
	this.pop = function(y){
		return cells[y].pop();
	}
	this.push = function(y, v){
		return cells[y].push(v);
	}
	this.toJSON = function(){
		return cells;
	}		
	this.load = function(new_cells){
		this.cells = cells = new_cells;
		this.y = cells.length;
		this.x = this.y ? cells[0].length : 0;
	}		
}
Array2D.prototype.set_size = function(x, y){	
	for(var i=this.y;i<y;i++){	
		this.cells.push(new Array(x));
	}
	for(var i=0;i<y;i++)
		this.cells[i].length = x;	
	this.x = x;
	this.y = y;
};	


var _model_id = 0;
function Level(x, y){
	Array2D.apply(this, arguments);
	var cells = this.cells;
	var self = this;
	this.level_id = _model_id++;
	this.event_names = ['size', 'cells', 'ranges'];
	this.listeners = {
		cells: [],
		ranges: [],
		size: []
	};
	this.get = function(x, y){
		return this.cells[y][x] = this.cells[y][x] || {};
	}
	this.update = function(x, y, data){
		var obj = this.get(x, y);
		for(var k in data)
			obj[k] = data[k];
	    this.listeners.cells.forEach(function(e){
	    	e(x, y, obj);
	    });
	}
	this.update_range = function(range, data){
		range(function(x, y){
			self.update(x, y, data);
		});
	    this.listeners.ranges.forEach(function(e){
	    	e(range, data);
	    });		
	}
	this.set_size = function(x, y){	
		Array2D.prototype.set_size.apply(this, arguments);
	    this.listeners.size.forEach(function(e){
	    	e();
	    });
	}
	this.listen = function(events){
		var self = this;
		this.event_names.forEach(function(e){
			if(events[e]){
				var index = self.listeners[e].indexOf(events[e]);
				self.listeners[e].push(events[e]);
			}	
		});		
	};
	this.unlisten = function(events){
		var self = this;
		this.event_names.forEach(function(e){
			if(events[e]){
				var index = self.listeners[e].indexOf(events[e]);
				self.listeners[e].slice(index, index+1);
			}	
		});
	};

}

Level.prototype = Object.create(Array2D.prototype);
Level.prototype.constructor = Level;

function Model(){
	this.levels = [];
	this.add_level = function(x, y){
		var level = new Level(x, y);
		this.levels.push(level);
		return level;
	}
	this.get_level = function(i){
		return this.levels[i];
	},
	this.set_size = function(x, y){
		this.levels.forEach(function(level){
			level.set_size(x, y);
		});
	}
	this.toJSON = function(){
		return this.levels.map(function(e){ return e.toJSON(); });
	}
	this.load= function(data){
		var levels = this.levels;
		levels.length = 0;
		data.forEach(function(e){
			var level = new Level(0,0);
			level.load(e);
			levels.push(level);
		});
	}

}

function LevelView(level){
	this.level = level;
	this.events = {
		cells: null,
		size: null
	};
}
LevelView.prototype.tag = 'div';
LevelView.prototype.render = function(){
	this.el = document.createElement(this.tag);
};	

LevelView.prototype.listen = function(){
	this.level.listen(this.events);
};	
LevelView.prototype.unlisten = function(){	
	this.level.unlisten(this.events);
};


function TableView(level){
	LevelView.apply(this, arguments);
	this.tag = 'table';
	var x = level.x,
		y = level.y,
		cells = new Array2D(x ,y),
		self = this;
	this.create_cell = function(row, x ,y){
		var cell = row.insertCell(-1);
		cell.title ='('+x+','+y+')';
		cell.watched = true;
		var data = level.get(x, y);
		cell.x=x; cell.y=y;
		self.addClass(cell, data);
		return cell;		
	}
	this.events = {
		cells: (function(){
			self.addClass(cells.get(x,y), data);
		}).bind(this),
		size: (function(){
			resize();
		}).bind(this)
	};	
	this.addClass = function(el, data){
		el.className = '';
			for(var k in data){
				if(data[k])
					if(k !== 'value')
						el.classList.add(k);	
					else if(k === 'value' && brushes[data[k]].className){
						el.classList.add(brushes[data[k]].className);
					}
			}		
	}
	var resize = function(){
		self.el.style.height = (self.el.offsetWidth * (y/x)) +"px";
	}	
	window.addEventListener('resize', resize);
	this.events = {
		cells: function(x, y, data){
			self.addClass(cells.get(x,y), data);
		},
		size: function(){
			var i,j;
			for(i=0;i<level.y && i < y;i++){
				for(j=x-1;j>=level.x;j--){
					cells.get(j, i).parentNode.removeChild(cells.pop(i));	
				}
				for(j=x;j<level.x;j++){
					cells.push(i, self.create_cell(cells.get(0, i).parentNode, j, i));				
				}				
			}
			cells.set_size(level.x, level.y);
			for(i=y;i<level.y;i++){
				var row = self.el.insertRow(-1);
				for(j=0;j<level.x;j++){
					cells.set(j, i, self.create_cell(row, j ,i)); 
				}
			}
			for(i=y-1;i>=level.y;i--)
				cells.get(0 ,i).parentNode.parentNode.removeChild(cells.get(0, i).parentNode);	
			x = level.x;
			y = level.y;
		}
	};
	this.render = function(){
		this.el = document.createElement(this.tag);
		for(var i=0;i<y;i++){
			var row = this.el.insertRow(-1);
			for(var j=0;j<x;j++){
				cells.set(j, i, this.create_cell(row, j, i)); 
			}
		}
		return this;
	}
	this.unlisten = function(){	
		LevelView.prototype.unlisten.apply(this, arguments);
		window.removeEventListener('resize', resize);
	};
}

TableView.prototype = Object.create(LevelView.prototype);
TableView.prototype.constructor = TableView;

function CanvasView(level){
	LevelView.apply(this, arguments);
	this.tag = 'canvas';
	this.block_size = 10;
	this.render_pending;
	var lazy_render = Debounce(this.render.bind(this),50);
	this.events = {
		cells: (function(x, y, data){
			var c;
			if(this.render_pending)
			 	this.render();
			if(data.value && brushes[data.value].colour){
				this.ctx.fillStyle = brushes[data.value].colour;
			}
			else{
				this.ctx.fillStyle = 'rgb(' + r + ', ' + (250-x) + ', ' + 155 + ')';
			}	
			var r = data.value && brushes[data.value].colour  ? 255 : 0;
			this.ctx.fillStyle = 'rgb(' + r + ', ' + (250-x) + ', ' + 155 + ')';
			this.ctx.fillRect(this.block_size*x, this.block_size*y, this.block_size, this.block_size);
			//this.ctx.strokeRect(this.block_size*x, this.block_size*y, this.block_size, this.block_size);
		}).bind(this),
		size: (function(){
			this.render_pending  = true;
			lazy_render();
		}).bind(this)
	}	
}
CanvasView.prototype = Object.create(LevelView.prototype);
CanvasView.prototype.constructor = CanvasView;


CanvasView.prototype.prep_canvas = function(){
	if(!this.el)
		this.el = document.createElement(this.tag);
	if(!this.ctx)
		this.ctx = this.el.getContext('2d');
	this.el.width = this.block_size*this.level.x;
	this.el.height = this.block_size*this.level.y;
	this.ctx.strokeStyle = 'rgb(0,0,0, 0.2)';
	this.ctx.clearRect(0, 0, this.block_size*this.level.x, this.block_size*this.level.y);
}
CanvasView.prototype.render = function(){
	this.prep_canvas();
	for (var i = 0; i < this.level.x; i += 1) {
        for (var j = 0; j < this.level.y; j += 1) {
        	var r= this.level.get(i, j).value == 'dig' ? 255 : 0;
			this.ctx.fillStyle = 'rgb(' + r + ', ' + (250-i) + ', ' + 155 + ')';
            this.ctx.fillRect(this.block_size*i, this.block_size*j, this.block_size, this.block_size);        }
    }	  
    this.render_pending = false;  
	return this;
};

function GridView(level){
	CanvasView.apply(this, arguments);
	this.events = {
		size: GridView.prototype.render.bind(this)
	}
}

GridView.prototype = Object.create(CanvasView.prototype);
GridView.prototype.constructor = GridView;

GridView.prototype.render = function(){
	this.prep_canvas();
	this.ctx.strokeStyle = 'rgb(175,175,175)';
	 this.ctx.lineWidth = 1;
	 this.ctx.translate(0.5, 0.5)
	for (var i = 1; i < this.level.x; i += 1) {
		this.ctx.moveTo(this.block_size*i, 0);
		this.ctx.lineTo(this.block_size*i, this.block_size*this.level.y);
	}
    for (var j = 1; j < this.level.y; j += 1) {
		this.ctx.moveTo(0, this.block_size*j);
		this.ctx.lineTo(this.block_size*this.level.y, this.block_size*j);    	
	}
	this.ctx.stroke();
	return this;
}

function SelectView(level){
	CanvasView.apply(this, arguments);

	this.events = {
		ranges: (function(range, data){
			var coords = range(null);
			console.log(data, coords);
			/*this.ctx.clearRect(coords.x1*this.block_size, coords.y1*this.block_size, 
				coords.x2*this.block_size, coords.y2*this.block_size);	*/

			if(data.select_pending || data.seleted){
				this.ctx.fillStyle = overlays.selected.colour;
				this.ctx.fillRect(coords.x1*this.block_size, coords.y1*this.block_size, 
					coords.x2*this.block_size, coords.y2*this.block_size);
			}
			else{
				this.ctx.clearRect(coords.x1*this.block_size, coords.y1*this.block_size, 
					coords.x2*this.block_size, coords.y2*this.block_size);
			}

		}).bind(this)
	}
}

SelectView.prototype = Object.create(CanvasView.prototype);
SelectView.prototype.constructor = SelectView;

SelectView.prototype.render = function(){
	this.prep_canvas();
	return this;
}

function LevelOutputView(level){
	var el = document.createElement('pre');
	var timer;
	var render = function(el, level){
		var str = '';
		Range(0,  0, level.x-1, level.y-1)(
			function(x, y){
			str += level.get(x, y).selected ? 'C' : 'N';
			str += (y===level.x-1) ? '\n': ',';
		});
		el.innerHTML = str;
	};
	var render_delay = function(el, level){
		if(timer)
			clearTimeout(timer);
		timer = setTimeout(function(){
			render(el, level);
		}, 1000)
	}
	level.listen({
		cells: function(x, y, data){
		render_delay(el, level);
	}})
	this.el = el;
	this.render = function(){
		render(el, level);
		return this;
	}	
}


function TableController(level){

}

function LevelController(level, view_type){
	var self = this;
	var view = new view_type(level).render();
	var mousedown;
	var drag_start;
	var hover;
	var selection = [];
	this.events = {
		'mousedown': function(event){
			if(event.srcElement.watched){
				mousedown = true;
				drag_start = event.srcElement;
				self.prev_drag = null;
			}
		},
		'mouseup': function(event){
			mousedown = false;
			if(self.prev_drag){
				selection.push(self.prev_drag);
				self.prev_drag(function(x, y){
					level.update(x, y, {'selected':true, 'select_pending': false});
				})
			}
			self.prev_drag = null;
		},
		'mouseleave': function(event){
			if(event.srcElement === view.el)
			mousedown = false;
		
		},		
		'mousemove': function(event){
			if(event.srcElement.watched && mousedown){
				self.drag(event);		   
			}
		},			
		'mouseover': function(event){
			if(hover)
				hover.classList.remove('hover');
			hover = null;
			event.srcElement.classList.add('hover');
			hover = event.srcElement;
		},
	};

	this.el = view.el;

	this.insert = function(el){
		this.parent = el;
		el.appendChild(view.el);
		view.listen();

		return view.el;
	};
	this.remove = function(){
		view.unlisten();
		this.parent.removeChild(view.el);
	}
	this.listen = function(){
		for(var ev in this.events){
			view.el.addEventListener(ev, this.events[ev]);
		}
		return this;
	};
	this.unlisten = function(){
		for(var ev in this.events){
			view.el.removeEventListener(ev, this.events[ev]);
		}
		return this;
	}	
	this.drag = function(event){
		var el = event.srcElement;
		if(this.prev_drag)
			level.update_range(this.prev_drag, {'select_pending': false})
		this.prev_drag = Range(el.x,  el.y, drag_start.x, drag_start.y)
		level.update_range(this.prev_drag, {'select_pending': true})
	};
	this.brush = function(value){
		selection.forEach(function(range){
			range(function(x, y){
				if(level.get(x, y).selected){
					level.update(x, y, {selected: false, value: value});
				}
			});
		});
	}
	/*setInterval(function(){
		level.update(Math.random() * level.x | 0, Math.random() *level.y  |0, {'value':'dig'});
	}, 300)*/
}


function OutputController(level){
	var view = new LevelOutputView(level);
	this.insert = function(el){
		this.parent = el;
		this.parent.appendChild(view.el);
		view.render();
		return view.el;
	};	
}

function MainController(el, storage){
	this.main_view = el.getElementsByClassName('main_view')[0];
	this.scroll_view = el.getElementsByClassName('scroll_view')[0];
	this.output_view = el.getElementsByClassName('output_view')[0];
	var self = this;
	var model = new Model();
	var controllers = [];
	var main_controller;
	var outputs = [];	
	var button_x = el.getElementsByClassName('level_size_x')[0];
	var button_y = el.getElementsByClassName('level_size_y')[0];
	var button_save = el.getElementsByClassName('save_fortress')[0];
	var button_load = el.getElementsByClassName('load_fortress')[0];
	var brush = el.getElementsByClassName('brush')[0];
	var button_place = el.getElementsByClassName('place')[0];
	var button_add_level = el.getElementsByClassName('add_level')[0]
	var level_x = 30, level_y = 30;

	button_x.value = level_x;
	button_y.value = level_y;
	this.level_selected = function(level){
		if(main_controller)
			main_controller.unlisten().remove();
		main_controller = new LevelController(level, TableView);
		main_controller.insert(this.main_view);
		main_controller.listen();
	};
	this.add_level_event = function(event){
		return self.add_level(model.add_level(level_x, level_y));
	};
	this.add_level = function(level){
		var controller = new LevelController(level, CanvasView);
		controller.insert(this.scroll_view);
		controllers.push(controller);	
		/*var output = new OutputController(level);
		output.insert(this.output_view);
		outputs.push(output);*/
		controller = new LevelController(level, SelectView);
		controller.insert(this.scroll_view);
		controllers.push(controller);	

		controller.el.addEventListener('click', function(){
			self.level_selected(level);
		});
		return controller;
	};
	this.place = function(){
		if(main_controller)
			main_controller.brush(brush.value);
	};
	this.save = function(){
		storage['fortress'] = JSON.stringify(model.toJSON());
	};
	this.load = function(){
		if(main_controller)
			main_controller.unlisten().remove();
		controllers.forEach(function(controller){
			controller.unlisten().remove();
		})	
		controllers.length = 0;	
		var data = JSON.parse(storage['fortress']);
		model = new Model(0,0);
		model.load(data);

		main_controller = null;		
		level_x = button_x.value = model.get_level(0).x;
		level_y = button_y.value = model.get_level(0).y;
		model.levels.forEach(function(level){
			self.add_level(level);
		});
		self.level_selected(model.levels[0]);
		trigger_resize();
	};
	this.level_xy = function(){
		level_x = parseInt(button_x.value, 10);
		level_y = parseInt(button_y.value, 10);
		model.set_size(level_x, level_y);
	};
	var keypress = function(event){
		event.preventDefault();
		switch(event.keyCode){
			case(32):
				self.place();
				break;
			default:
		};
	};	
	this.setup_controls = function(){
		for(var b in brushes){
			var option = document.createElement("option");
			option.value = b;
			option.label = brushes[b].label;
			brush.add(option);
		};
		button_add_level.addEventListener('click', this.add_level_event);
		button_x.addEventListener('change', this.level_xy);
		button_y.addEventListener('change', this.level_xy);
		button_save.addEventListener('click', this.save);
		button_load.addEventListener('click', this.load);
		button_place.addEventListener('click', this.place);
		el.addEventListener('keypress', keypress);	
	};
	var trigger_resize = function(){
		var evt = document.createEvent('UIEvents');
		evt.initUIEvent('resize', true, false,window,0);
		window.dispatchEvent(evt);	
	};
	this.start = function(){
		this.setup_controls();
		var lev = model.add_level(level_x, level_y);
		this.add_level(lev);
		this.level_selected(lev);
		trigger_resize();
	}
	this.stop = function(){
		button_add_level.removeEventListener('click', this.add_level_event);
		button_x.removeEventListener('change', this.level_xy);
		button_y.removeEventListener('change', this.level_xy);
		button_save.removeEventListener('click', this.save);
		button_load.removeEventListener('click', this.load);
		button_place.removeEventListener('click', this.place);
		el.removeEventListener('keypress', keypress);	
	};
	this.get_model = function(){
		return model;
	};
}

function assert(bool){
	if(!bool){
		throw('Assert Failed')
	}
}


function Tests(){
	console.time('Tests');
	try{
		var el = document.body.cloneNode(true);
		var fortress = new MainController(el, {});
		var button_x = el.getElementsByClassName('level_size_x')[0];
		var button_y = el.getElementsByClassName('level_size_y')[0];	
		var model = fortress.get_model();
		fortress.start();
		fortress.add_level_event();
		button_x.value = 100;
		fortress.level_xy();
		fortress.add_level_event();	
		button_y.value = 10;
		fortress.level_xy();
		fortress.add_level_event();	
		fortress.save();
		button_y.value = 100;
		fortress.level_xy();
		fortress.add_level_event();	
		fortress.load();
		button_x.value = 10;	
		fortress.level_xy();
		fortress.add_level_event();	
		fortress.level_selected(model.get_level(2))
		fortress.stop();
	}catch(e){
		console.log('TESTS FAIL')
		console.log(e)
	}
	console.timeEnd('Tests')
}

function main(){
	//Tests();
	var fortress = new MainController(document.body, localStorage);
	fortress.start();
}




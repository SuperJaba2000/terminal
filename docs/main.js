let width = 45;//45
let height = 40;//40
let p = 10;

let canvas = document.getElementById('canvas');
let select_entity = document.getElementById('select-entity');
let select_layer  = document.getElementById('select-layer');
let select_tool   = document.getElementById('select-tool');

canvas.width = width*p;
canvas.height = height*p;

let map = new Array(height).fill([]).map( () => new Array(width).fill(0).map( () => [-1, -1]) );

let ctx = canvas.getContext('2d');

let layer = 0;

class Entity {
	constructor(name, colorCodes, symbols = [' '], symbolChoise = 0) {
		this.name = name;
		this.colorCodes = colorCodes;
		this.symbols = symbols;
		this.symbolChoise = symbolChoise;
	}
	
	color() {
		return this.colorCodes[2];
	}
	
	symbol(x, y, t) {
		if(this.symbolChoise == 0){
			return this.symbols[0];
		}else if(this.symbolChoise == 1){
			return this.symbols[Random.basic(0, this.symbols.length-1)];
		}
		
		return this.symbols[0];
	}
};

class Block extends Entity {
	constructor(name, colorCodes, symbols, symbolChoise = 0, walkable = false){
		super(name, colorCodes, symbols, symbolChoise)
		
		this.walkable = walkable;
	}
};

class Floor extends Entity {
	
};

let entities = {
	/* -- region special -- */
	[0]: new Entity('void', [0, 0, 'black']),
	
	/* -- region floors -- */
	[1]: new Entity('floor-stone', [100, '48;5;241', 'grey']),
	[2]: new Entity('floor-grass', [42, '48;5;28', 'green']),
	[3]: new Entity('floor-sand',  [103, '48;5;227', 'yellow']),
	[4]: new Entity('floor-snow',  [107, '48;5;15', 'white']),
	[5]: new Entity('floor-ruin',  [47, '48;5;239', 'firebrick']),
	/* 6 - 9 ids are reserved */
	[10]: new Entity('floor-shallow-water', [104, '48;5;20', 'blue']),
	[11]: new Entity('floor-deep-water',    [44, '48;5;17', 'navy']),
	/* 12 - 15 ids are reserved */
	
	/* -- region blocks -- */
	[16]: new Entity('block-small-bush', ['1;92', '38;5;22', 'darkgreen'], ['♣', '♠'], 1),
	/* 17 - 20 ids are reserved */
	[21]: new Entity('block-ruin-horizontal',   [33, '38;5;236'], ['═']),
	[22]: new Entity('block-ruin-vertical',     [33, '38;5;236'], ['║']),
	[23]: new Entity('block-ruin-top-left',     [33, '38;5;236'], ['╔']),
	[24]: new Entity('block-ruin-top-right',    [33, '38;5;236'], ['╗']),
	[25]: new Entity('block-ruin-bottom-left',  [33, '38;5;236'], ['╚']),
	[26]: new Entity('block-ruin-bottom-right', [33, '38;5;236'], ['╝']),
	[27]: new Entity('block-mangeta-crystal',   [35, '38;5;92']   ['♦']),
	/* 28 - 31 ids are reserved */
			
	/* -- region overlays -- */
	[32]: new Entity('overlay-sunflower', [93, '38;5;226', 'yellow'], ['°'], 0, true),
	[33]: new Entity('overlay-seaweed',   [32, '38;5;34', 'seagreen'], ['░'], 0, true),
}

for(let e in entities){
	let option = document.createElement('option');
	option.value = e;
	option.text = entities[e].name;
	
	select_entity.appendChild(option)
}

for(let l = 0; l < 3; l++){
	let option = document.createElement('option');
	option.value = l;
	option.text = `layer ${l+1}`;
	
	if(l == 2){
		option.text = 'all layers';
	}
	
	select_layer.appendChild(option)
}

let tools = [
    "brush",
	"fill"
];

let activeTool = 0;

for(let tool = 0; tool < tools.length; tool++){
	let option = document.createElement('option');
	option.value = tool;
	option.text = tools[tool];
	
	select_tool.appendChild(option)
}

select_tool.addEventListener('change', function(){
	activeTool = this.value;
})

select_entity.addEventListener('change', function(){
	activeEntity = Number(this.value);
})

select_layer.addEventListener('change', function(){
	layer = this.value;
	render()
})

let activeEntity = 0;

function drawTile(x, y){
	let tile = map[y][x];
	
	if(typeof tile[layer] != 'number' || tile[layer] == -1)
		return;
	
	let entity = entities[tile[layer]];
	
	ctx.fillStyle = entity.color();
	
	if(entity.symbol() == ' '){
	    ctx.fillRect(x*p, y*p, p, p)
	}else{
	    ctx.font = `${p}px serif`;
        ctx.fillText(entity.symbol(), x*p, y*p);
	}
}

function render() {
	ctx.clearRect(0, 0, canvas.width, canvas.height)
	
	for(let y = 0; y < height; y++){
        for(let x = 0; x < width; x++){
			if(layer == 2){
				layer = 0;
				drawTile(x, y)
				
				layer = 1;
				drawTile(x, y)
				
				layer = 2;
				continue;
			}
           
		   drawTile(x, y)
        }		
    }
}

let isDrawing = false;

function draw(e) {
	let w1 = canvas.clientWidth / width;
	let h1 = canvas.clientHeight / height;
	
	let x = Math.floor((e.clientX - canvas.offsetLeft) / w1);
	let y = Math.floor((e.clientY - canvas.offsetTop) / h1);
	
	if(layer == 2)
		return;
	
	if(activeTool == 1){
		let grid = new PF.Grid(width, height);
		
		let startX = x;
		let startY = y;
		let startEntity = map[y][x][layer];
		
		for(let y = 0; y < height; y++){
            for(let x = 0; x < width; x++){
                grid.setWalkableAt(x, y, map[y][x][layer] == startEntity);
           }		
        }
		
		for(let y = 0; y < height; y++){
            for(let x = 0; x < width; x++){
                var finder = new PF.AStarFinder();
				
				var path = finder.findPath(startX, startY, x, y, grid.clone())
				
				if(path.length > 1)
					map[y][x][layer] = activeEntity;
           }		
        }
		
		map[startY][startX][layer] = activeEntity;

	}else if(activeTool == 0){
		map[y][x][layer] = activeEntity;
    }
    render()
}

canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
	draw(e)
})

canvas.addEventListener('mousemove', (e) => {
    if (isDrawing) {
        draw(e)
    }
});

window.addEventListener('mouseup', (e) => {
    isDrawing = false;
})

render()

function toFile() {
	var name = document.getElementById('map-name').value||'unnamed';
	var a = document.getElementById("lfs");
    var file = new Blob([JSON.stringify([
	    {
			name: name
		},
	    map
	])], {
        type: 'plain/text'
    })
    a.href = URL.createObjectURL(file);
    a.download = `${name}.json`;
    a.click();
}

document.getElementById('button-export').onclick = toFile;